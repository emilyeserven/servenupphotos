package github

import (
	"encoding/json"
	"net/http"
	"strings"
)

// parseLLMAnswer reads the JSON object in text, an LLM's answer, into
// answer. The object may be inside a code block or have words around it:
// everything before its first { and after its last } is ignored. The error
// it returns is one the user can read, asking them to paste the whole answer
// or to ask the LLM for only the JSON. Every prompt that asks the LLM for
// JSON (Bulk Tagging, Tag pruning, Tag library, album and genre suggestions,
// alt text) reads the answer with it; each then checks the answer has
// something in it. Curly double quotes (“ ”) around keys and values, which
// text copied from a chat app often has, are read as straight ones.
func parseLLMAnswer(text string, answer any) *PublishError {
	start, end := strings.Index(text, "{"), strings.LastIndex(text, "}")
	if start < 0 || end < start {
		return publishErr(http.StatusBadRequest, unreadableAnswer)
	}
	if err := unmarshalPasted(text[start:end+1], answer); err != nil {
		return publishErr(http.StatusBadRequest, "The answer isn't the JSON the prompt asks for (%v). Ask the LLM to answer with only that JSON.", err)
	}
	return nil
}

// unreadableAnswer is what every answer box says when the pasted text has no
// JSON object in it. The browser's readPastedObject (lib/pasted-json.ts)
// says the same.
const unreadableAnswer = "The answer has no JSON object that can be read. Paste the LLM's whole answer, from { to }, or ask it to answer with only the JSON."

// quotesAround is the quotes, straight or curly, an answer sometimes leaves
// around a name.
const quotesAround = "\"'\u201c\u201d\u2018\u2019"

// matchName is a name as an LLM's answer gave it, made ready for matching to
// a photo: trimmed, without quotes around it or a ".json" ending, in lower
// case, so "IMG_1.JSON" matches the photo img_1. Every lookup of a photo by a
// name in a pasted answer compares with it; the browser's matchName
// (lib/pasted-json.ts) does the same.
func matchName(name string) string {
	clean := strings.TrimSpace(strings.Trim(strings.TrimSpace(name), quotesAround))
	if strings.HasSuffix(strings.ToLower(clean), ".json") {
		clean = clean[:len(clean)-len(".json")]
	}
	return strings.ToLower(clean)
}

// sameName reports whether name, as an answer gave it, names the photo
// called photo, matching both with matchName.
func sameName(name, photo string) bool {
	return matchName(name) == matchName(photo)
}

// straightQuotes makes every curly double quote (“ ”) straight ("), leaving
// curly single quotes (‘ ’) as they are.
var straightQuotes = strings.NewReplacer("\u201c", `"`, "\u201d", `"`)

// unmarshalPasted reads the JSON in text into answer. When it doesn't read as
// it is, it's read again with its curly double quotes made straight, so an
// answer copied with them around its keys and values still reads, while one
// that only has them inside its values is read untouched. When neither reads,
// it returns the error from the text as it was pasted.
func unmarshalPasted(text string, answer any) error {
	err := json.Unmarshal([]byte(text), answer)
	if err == nil {
		return nil
	}
	straight := straightQuotes.Replace(text)
	if straight == text || json.Unmarshal([]byte(straight), answer) != nil {
		return err
	}
	return nil
}
