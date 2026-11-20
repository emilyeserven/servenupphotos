package httpapi

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"unicode"
)

// messageArgs is, for each function that answers a request, which of its
// arguments is a message the user reads.
var messageArgs = map[string]int{
	"writeError":         2,
	"writeResult":        3,
	"writeR2Result":      3,
	"badRequest":         0,
	"withGitHub":         2,
	"withGitHubBody":     3,
	"withGitHubBodyUpTo": 4,
	"handleBulkTags":     2,
	"handleBulkTagsUpTo": 3,
}

// lowercaseStarts are words a message may start with in lowercase, because
// that's how they're written.
var lowercaseStarts = []string{"exiftool"}

// TestMessagesAreSentences checks that every message the handlers answer
// with is a sentence: it starts with a capital and ends with a full stop or
// a question mark. It looks at the messages passed to writeError, writeResult
// and the with* helpers, a PublishError's Message, and a message returned
// next to an HTTP status.
func TestMessagesAreSentences(t *testing.T) {
	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	fset := token.NewFileSet()
	for _, name := range files {
		if strings.HasSuffix(name, "_test.go") {
			continue
		}
		src, err := os.ReadFile(name) //nolint:gosec // a file in this package
		if err != nil {
			t.Fatal(err)
		}
		file, err := parser.ParseFile(fset, name, src, 0)
		if err != nil {
			t.Fatal(err)
		}
		for _, msg := range userMessages(file) {
			if problem := sentenceProblem(msg); problem != "" {
				t.Errorf("%s: %s", fset.Position(msg.Pos()), problem)
			}
		}
	}
}

// userMessages finds the expressions in file that are messages a user reads.
func userMessages(file *ast.File) []ast.Expr {
	var found []ast.Expr
	ast.Inspect(file, func(n ast.Node) bool {
		switch n := n.(type) {
		case *ast.CallExpr:
			if i, ok := messageArgs[calledName(n.Fun)]; ok && i < len(n.Args) {
				found = append(found, n.Args[i])
			}
		case *ast.KeyValueExpr:
			if key, ok := n.Key.(*ast.Ident); ok && key.Name == "Message" {
				found = append(found, n.Value)
			}
		case *ast.ReturnStmt:
			found = append(found, messageAfterStatus(n.Results)...)
		}
		return true
	})
	return found
}

// calledName is the name of the function fun calls, without type arguments.
func calledName(fun ast.Expr) string {
	switch f := fun.(type) {
	case *ast.Ident:
		return f.Name
	case *ast.IndexExpr:
		return calledName(f.X)
	case *ast.IndexListExpr:
		return calledName(f.X)
	}
	return ""
}

// messageAfterStatus is the string returned right after an http.Status
// constant, as in `return nil, http.StatusBadRequest, "…"`.
func messageAfterStatus(results []ast.Expr) []ast.Expr {
	for i := 0; i+1 < len(results); i++ {
		sel, ok := results[i].(*ast.SelectorExpr)
		if !ok || !strings.HasPrefix(sel.Sel.Name, "Status") {
			continue
		}
		if x, ok := sel.X.(*ast.Ident); ok && x.Name == "http" {
			return []ast.Expr{results[i+1]}
		}
	}
	return nil
}

// sentenceProblem says why msg isn't a sentence, or "" when it is or can't
// be told from the source. Only its first and last string literals are read.
func sentenceProblem(msg ast.Expr) string {
	first, last := literalEnds(msg)
	if first != nil {
		text, err := strconv.Unquote(first.Value)
		if err == nil && text != "" && !startsLikeSentence(text) {
			return "message should start with a capital: " + first.Value
		}
	}
	if last != nil {
		text, err := strconv.Unquote(last.Value)
		if err == nil && text != "" && !strings.HasSuffix(text, ".") && !strings.HasSuffix(text, "?") {
			return "message should end with a full stop: " + last.Value
		}
	}
	return ""
}

// literalEnds is the string literal msg starts with and the one it ends
// with, each nil when that end is something else, such as err.Error().
func literalEnds(msg ast.Expr) (first, last *ast.BasicLit) {
	switch m := msg.(type) {
	case *ast.BasicLit:
		if m.Kind == token.STRING {
			return m, m
		}
	case *ast.BinaryExpr:
		if m.Op == token.ADD {
			first, _ = literalEnds(m.X)
			_, last = literalEnds(m.Y)
			return first, last
		}
	case *ast.CallExpr:
		// fmt.Sprintf("…", …) reads as its format.
		if sel, ok := m.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "Sprintf" && len(m.Args) > 0 {
			return literalEnds(m.Args[0])
		}
	}
	return nil, nil
}

// startsLikeSentence reports whether text starts with a capital, or with a
// word that's always written in lowercase.
func startsLikeSentence(text string) bool {
	for _, word := range lowercaseStarts {
		if strings.HasPrefix(text, word) {
			return true
		}
	}
	r := []rune(text)[0]
	return !unicode.IsLetter(r) || unicode.IsUpper(r)
}
