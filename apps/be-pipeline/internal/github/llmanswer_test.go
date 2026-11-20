package github

import "testing"

func TestParseLLMAnswerCurlyQuotes(t *testing.T) {
	var answer struct {
		City      string `json:"city"`
		Exact     bool   `json:"exact"`
		Reasoning string `json:"reasoning"`
	}
	text := "```json\n{“city”: “Cheongju”, “exact”: true, “reasoning”: “after the shot ‘Train to Busan II’”}\n```"
	if perr := parseLLMAnswer(text, &answer); perr != nil {
		t.Fatalf("parseLLMAnswer: %v", perr)
	}
	if answer.City != "Cheongju" || !answer.Exact || answer.Reasoning != "after the shot ‘Train to Busan II’" {
		t.Errorf("answer = %+v", answer)
	}
}

func TestParseLLMAnswerKeepsCurlyQuotesInValues(t *testing.T) {
	var answer struct {
		Reasoning string `json:"reasoning"`
	}
	if perr := parseLLMAnswer(`{"reasoning": "near “Osong”"}`, &answer); perr != nil {
		t.Fatalf("parseLLMAnswer: %v", perr)
	}
	if answer.Reasoning != "near “Osong”" {
		t.Errorf("reasoning = %q", answer.Reasoning)
	}
}

func TestParseLLMAnswerNotJSON(t *testing.T) {
	var answer map[string]any
	if perr := parseLLMAnswer("{“city”: Cheongju}", &answer); perr == nil {
		t.Error("parseLLMAnswer read an answer that isn't JSON")
	}
}

func TestMatchName(t *testing.T) {
	for _, name := range []string{"img_1", " IMG_1 ", "IMG_1.JSON", `"img_1.json"`, "“IMG_1”", "'img_1'"} {
		if got := matchName(name); got != "img_1" {
			t.Errorf("matchName(%q) = %q, want img_1", name, got)
		}
	}
	if sameName("img_10", "img_1") {
		t.Error("sameName matched img_10 to img_1")
	}
}
