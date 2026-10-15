package storage

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// CheckResult says whether a connection check worked, in words fit to show
// the person who entered the settings.
type CheckResult struct {
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

// accountIDPattern matches a Cloudflare account ID: 32 hex characters.
var accountIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{32}$`)

// CheckR2 lists at most one object in the configured bucket. That needs the
// account ID, both halves of the key and the bucket to all be right, and is
// allowed by an "Object Read" token, so it is a cheap end-to-end check that
// changes nothing.
func CheckR2(ctx context.Context, cfg settings.R2) CheckResult {
	return checkR2(ctx, cfg, r2Endpoint(cfg))
}

func checkR2(ctx context.Context, cfg settings.R2, endpoint string) CheckResult {
	if msg := validateR2(cfg); msg != "" {
		return CheckResult{Message: msg}
	}
	_, err := newR2Client(cfg, endpoint).ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket:  aws.String(strings.TrimSpace(cfg.Bucket)),
		MaxKeys: aws.Int32(1),
	})
	if err != nil {
		return CheckResult{Message: describeR2Error(err)}
	}
	return CheckResult{OK: true, Message: "Connected to " + strings.TrimSpace(cfg.Bucket) + "."}
}

// r2Endpoint is the S3 API endpoint of the account in cfg.
func r2Endpoint(cfg settings.R2) string {
	return fmt.Sprintf("https://%s.r2.cloudflarestorage.com", strings.TrimSpace(cfg.AccountID))
}

// validateR2 returns why cfg can't be used to reach a bucket, or "" if it can.
func validateR2(cfg settings.R2) string {
	if missing := missingR2Fields(cfg); len(missing) > 0 {
		return "Fill in " + strings.Join(missing, ", ") + " first."
	}
	// The account ID becomes part of a hostname, so only a real one is used.
	if !accountIDPattern.MatchString(strings.TrimSpace(cfg.AccountID)) {
		return "The account ID should be 32 letters and numbers, as shown in the Cloudflare dashboard."
	}
	return ""
}

func newR2Client(cfg settings.R2, endpoint string) *s3.Client {
	return s3.New(s3.Options{
		Region:       "auto",
		BaseEndpoint: aws.String(endpoint),
		UsePathStyle: true,
		Credentials: credentials.NewStaticCredentialsProvider(
			strings.TrimSpace(cfg.AccessKeyID), cfg.SecretAccessKey, ""),
		RetryMaxAttempts: 1,
		// Skip the checksums the SDK adds to uploads by default; R2 doesn't
		// need them and not every algorithm is supported.
		RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired,
	})
}

func missingR2Fields(cfg settings.R2) []string {
	var missing []string
	for _, f := range []struct{ name, value string }{
		{"Account ID", cfg.AccountID},
		{"Access key ID", cfg.AccessKeyID},
		{"Secret access key", cfg.SecretAccessKey},
		{"Bucket", cfg.Bucket},
	} {
		if strings.TrimSpace(f.value) == "" {
			missing = append(missing, f.name)
		}
	}
	return missing
}

// describeR2Error turns an S3 error into a reason a person can act on.
// R2's error codes: https://developers.cloudflare.com/r2/api/error-codes/
func describeR2Error(err error) string {
	if errors.Is(err, context.DeadlineExceeded) {
		return "Cloudflare didn't answer in time. Check the account ID."
	}
	var apiErr smithy.APIError
	if !errors.As(err, &apiErr) {
		return "Couldn't reach Cloudflare. Check the account ID."
	}
	switch apiErr.ErrorCode() {
	case "InvalidAccessKeyId", "InvalidArgument":
		return "Cloudflare didn't recognize the access key ID."
	case "SignatureDoesNotMatch":
		return "The secret access key doesn't match the access key ID."
	case "NoSuchBucket":
		return "There's no bucket with that name in this account."
	case "AccessDenied", "Unauthorized":
		return "This token isn't allowed to read that bucket."
	}
	if msg := apiErr.ErrorMessage(); msg != "" {
		return "Cloudflare said: " + msg
	}
	return "Cloudflare rejected the request (" + apiErr.ErrorCode() + ")."
}
