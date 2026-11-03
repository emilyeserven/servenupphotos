package github

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxCaptionTemplateLength is the most characters a caption template can
// have, comfortably over Instagram's 2,200 character captions.
const maxCaptionTemplateLength = 5000

// CaptionTemplate is a caption template file: the text of a social media
// post's caption with placeholders, such as "{title} · {city}", which the
// Photo page's Generate fills from the photo's data.
type CaptionTemplate struct {
	ID string `json:"id"`
	// Name is how the Photo page lists the template, such as "Instagram".
	Name string `json:"name"`
	// Platform is the social media site the template is for, such as
	// "instagram", which a post on that site starts with; "" for any.
	Platform string `json:"platform"`
	// Template is the caption's text, with each placeholder a photo field in
	// braces, such as {camera}.
	Template string `json:"template"`
}

// SaveCaptionTemplate saves template as <folder>/captions/<id>.json, new or
// replacing the one there, in the pending changes. It fails when another
// caption template has the same name, ignoring case.
func (c *Client) SaveCaptionTemplate(ctx context.Context, gh settings.GitHub, template CaptionTemplate) (EntryResult, error) {
	template, perr := validCaptionTemplate(template)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, Captions, template.ID, template, func(others []Entry) *PublishError {
		for _, o := range parseCaptionTemplates(others) {
			if strings.EqualFold(o.Name, template.Name) {
				return publishErr(http.StatusConflict, "There's already a caption template named %q (%s). Pick another name.", o.Name, o.ID)
			}
		}
		return nil
	})
}

// DeleteCaptionTemplate removes the caption template file named id in the
// pending changes. Captions made from it are kept.
func (c *Client) DeleteCaptionTemplate(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, Captions, id, func([]Entry) *PublishError { return nil })
}

// parseCaptionTemplates is the caption templates in entries that can be
// read.
func parseCaptionTemplates(entries []Entry) []CaptionTemplate {
	var out []CaptionTemplate
	for _, e := range entries {
		var t CaptionTemplate
		if json.Unmarshal(e.Data, &t) == nil && t.ID != "" {
			out = append(out, t)
		}
	}
	return out
}

// validCaptionTemplate checks t and returns it as it will be saved: its name
// and platform trimmed, and its text without trailing space.
func validCaptionTemplate(t CaptionTemplate) (CaptionTemplate, *PublishError) {
	out := CaptionTemplate{
		ID: strings.TrimSpace(t.ID), Name: strings.TrimSpace(t.Name), Platform: strings.TrimSpace(t.Platform),
		Template: strings.TrimRight(t.Template, " \t\r\n"),
	}
	if perr := validEntryID(Captions.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Name == "" || strings.TrimSpace(out.Template) == "" {
		return out, publishErr(http.StatusBadRequest, "Give the caption template a name and some text.")
	}
	if utf8.RuneCountInString(out.Name) > maxEntryTextLength || utf8.RuneCountInString(out.Platform) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Keep the name and the platform to %d characters each.", maxEntryTextLength)
	}
	if utf8.RuneCountInString(out.Template) > maxCaptionTemplateLength {
		return out, publishErr(http.StatusBadRequest, "Keep the template to %d characters.", maxCaptionTemplateLength)
	}
	return out, nil
}
