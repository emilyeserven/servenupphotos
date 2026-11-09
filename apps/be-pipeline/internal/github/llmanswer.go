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
// something in it.
func parseLLMAnswer(text string, answer any) *PublishError {
	start, end := strings.Index(text, "{"), strings.LastIndex(text, "}")
	if start < 0 || end < start {
		return publishErr(http.StatusBadRequest, "Paste the LLM's whole answer: the JSON object it wrote, from { to }.")
	}
	if err := json.Unmarshal([]byte(text[start:end+1]), answer); err != nil {
		return publishErr(http.StatusBadRequest, "The answer isn't the JSON the prompt asks for (%v). Ask the LLM to answer with only that JSON.", err)
	}
	return nil
}
