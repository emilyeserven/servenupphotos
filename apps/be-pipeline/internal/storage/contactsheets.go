package storage

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// ContactSheetsFolder is the folder in the bucket contact sheets go in. It's
// only for sheets: the bucket's lifecycle rule deletes everything in it a day
// after it's put there.
const ContactSheetsFolder = "contact-sheets/"

// contactSheetRuleID names the lifecycle rule that deletes contact sheets.
const contactSheetRuleID = "delete-contact-sheets"

// contactSheetDays is how many days a contact sheet is kept. R2 counts
// lifecycle rules in whole days, and may delete a little after the day ends.
const contactSheetDays = 1

// UploadContactSheets puts each JPEG in sheets in the bucket as
// contact-sheets/<time>-<random>/sheet-01.jpg and on, a new folder each time
// so a link never shows another set's sheet, and gives their public links in
// order. Failures are *UploadError.
func UploadContactSheets(ctx context.Context, cfg settings.R2, sheets [][]byte) ([]string, error) {
	return uploadContactSheets(ctx, cfg, r2Endpoint(cfg), sheets, time.Now())
}

func uploadContactSheets(ctx context.Context, cfg settings.R2, endpoint string, sheets [][]byte, now time.Time) ([]string, error) {
	base, err := gearBase(cfg)
	if err != nil {
		return nil, err
	}
	folder := ContactSheetsFolder + now.UTC().Format("20060102-150405") + "-" + randomHex(4) + "/"
	client := newR2Client(cfg, endpoint)
	links := make([]string, 0, len(sheets))
	for i, sheet := range sheets {
		key := fmt.Sprintf("%ssheet-%02d.jpg", folder, i+1)
		if err := putObject(ctx, client, cfg, key, bytes.NewReader(sheet), int64(len(sheet)), "image/jpeg", nil); err != nil {
			return nil, err
		}
		links = append(links, base+"/"+key)
	}
	return links, nil
}

// randomHex is n random bytes written in hex.
func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b) // never fails on the platforms Go supports
	return hex.EncodeToString(b)
}

// EnsureContactSheetExpiry makes sure the bucket has a lifecycle rule that
// deletes everything in ContactSheetsFolder a day after it's put there,
// adding it next to the bucket's other rules when it's missing. It says why
// it couldn't, with how to add the rule in the Cloudflare dashboard instead,
// or "" once the rule is there. Changing a bucket's settings needs an R2
// token with Admin Read & Write; an Object Read & Write token can only make
// the sheets, not set the rule.
func EnsureContactSheetExpiry(ctx context.Context, cfg settings.R2) string {
	return ensureContactSheetExpiry(ctx, cfg, r2Endpoint(cfg))
}

// contactSheetRuleHelp is how to add the rule by hand.
const contactSheetRuleHelp = " To delete contact sheets after a day, open the bucket in the Cloudflare dashboard, go to Settings → Object lifecycle rules, and add a rule that deletes objects with the prefix " +
	ContactSheetsFolder + " after 1 day."

func ensureContactSheetExpiry(ctx context.Context, cfg settings.R2, endpoint string) string {
	if msg := validateR2(cfg); msg != "" {
		return msg
	}
	client := newR2Client(cfg, endpoint)
	bucket := aws.String(strings.TrimSpace(cfg.Bucket))
	rules, err := lifecycleRules(ctx, client, bucket)
	if err != nil {
		return "Couldn't read the bucket's lifecycle rules: " + describeR2Error(err) + contactSheetRuleHelp
	}
	if hasContactSheetRule(rules) {
		return ""
	}
	_, err = client.PutBucketLifecycleConfiguration(ctx, &s3.PutBucketLifecycleConfigurationInput{
		Bucket:                 bucket,
		LifecycleConfiguration: &types.BucketLifecycleConfiguration{Rules: append(rules, contactSheetRule())},
	})
	if err != nil {
		return "Couldn't add the lifecycle rule: " + describeR2Error(err) + contactSheetRuleHelp
	}
	return ""
}

// lifecycleRules is the bucket's lifecycle rules, none when it has no
// lifecycle configuration.
func lifecycleRules(ctx context.Context, client *s3.Client, bucket *string) ([]types.LifecycleRule, error) {
	out, err := client.GetBucketLifecycleConfiguration(ctx, &s3.GetBucketLifecycleConfigurationInput{Bucket: bucket})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchLifecycleConfiguration" {
			return nil, nil
		}
		return nil, err
	}
	return out.Rules, nil
}

// hasContactSheetRule reports whether rules already delete contact sheets
// within a day: this pipeline's rule, or an enabled one someone added by
// hand for the folder.
func hasContactSheetRule(rules []types.LifecycleRule) bool {
	for _, rule := range rules {
		if aws.ToString(rule.ID) == contactSheetRuleID {
			return true
		}
		if rule.Status != types.ExpirationStatusEnabled || rule.Expiration == nil || aws.ToInt32(rule.Expiration.Days) != contactSheetDays {
			continue
		}
		if rule.Filter != nil && aws.ToString(rule.Filter.Prefix) == ContactSheetsFolder {
			return true
		}
	}
	return false
}

// contactSheetRule deletes everything in ContactSheetsFolder after
// contactSheetDays.
func contactSheetRule() types.LifecycleRule {
	return types.LifecycleRule{
		ID:         aws.String(contactSheetRuleID),
		Status:     types.ExpirationStatusEnabled,
		Filter:     &types.LifecycleRuleFilter{Prefix: aws.String(ContactSheetsFolder)},
		Expiration: &types.LifecycleExpiration{Days: aws.Int32(contactSheetDays)},
	}
}

// DeletedContactSheets is what deleting contact sheets did.
type DeletedContactSheets struct {
	// Deleted is how many sheets are gone from the bucket now.
	Deleted int `json:"deleted"`
	// Failed is the keys still in the bucket, each with why.
	Failed []FailedDelete `json:"failed"`
}

// FailedDelete is an object that couldn't be deleted, and why.
type FailedDelete struct {
	Key     string `json:"key"`
	Message string `json:"message"`
}

// contactSheetSetPattern matches the name of one set of sheets, the folder
// UploadContactSheets made, such as 20261115-045000-1a2b3c4d.
var contactSheetSetPattern = regexp.MustCompile(`^[0-9]{8}-[0-9]{6}-[0-9a-f]+$`)

// DeleteContactSheets deletes every object in one set's folder of
// ContactSheetsFolder, named by set (such as 20261115-045000-1a2b3c4d), or
// in all of ContactSheetsFolder when set is "". Nothing outside that folder
// can be deleted. Failures to list are *ListError; objects that couldn't be
// deleted are in Failed.
func DeleteContactSheets(ctx context.Context, cfg settings.R2, set string) (DeletedContactSheets, error) {
	return deleteContactSheets(ctx, cfg, r2Endpoint(cfg), set)
}

func deleteContactSheets(ctx context.Context, cfg settings.R2, endpoint, set string) (DeletedContactSheets, error) {
	if msg := validateR2(cfg); msg != "" {
		return DeletedContactSheets{}, &ListError{Message: msg, NotConfigured: true}
	}
	prefix := ContactSheetsFolder
	if set != "" {
		if !contactSheetSetPattern.MatchString(set) {
			return DeletedContactSheets{}, &ListError{Message: "That isn't a set of contact sheets."}
		}
		prefix += set + "/"
	}
	client := newR2Client(cfg, endpoint)
	keys, err := listKeys(ctx, client, cfg, prefix)
	if err != nil {
		return DeletedContactSheets{}, err
	}
	out := DeletedContactSheets{Failed: []FailedDelete{}}
	for _, key := range keys {
		if msg := deleteObject(ctx, cfg, endpoint, key); msg != "" {
			out.Failed = append(out.Failed, FailedDelete{Key: key, Message: msg})
			continue
		}
		out.Deleted++
	}
	return out, nil
}

// listKeys is the key of every object under prefix. Failures are *ListError.
func listKeys(ctx context.Context, client *s3.Client, cfg settings.R2, prefix string) ([]string, error) {
	var keys []string
	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
		Prefix: aws.String(prefix),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, &ListError{Message: describeR2Error(err)}
		}
		for _, obj := range page.Contents {
			keys = append(keys, aws.ToString(obj.Key))
		}
	}
	return keys, nil
}
