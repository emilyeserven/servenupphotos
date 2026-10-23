package github

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"unicode/utf8"
)

// printWidth is the line width oxfmt formats the repository's JSON to.
const printWidth = 100

// jsonNode is one parsed JSON value, keeping object keys in their order and
// numbers as written.
type jsonNode struct {
	// scalar is a string, number, boolean or null as it's printed; empty for
	// an object or array.
	scalar string
	// keys are an object's keys in order, with values its values; both are nil
	// for an array, which has only values.
	keys     []string
	values   []jsonNode
	isObject bool
}

// formatJSONArray prints entries as one JSON array the way the "Combine photo
// data" workflow writes a combined list, jq's output formatted by oxfmt:
// objects one key per line, an array of plain values on one line when it fits
// in printWidth, and two spaces of indent.
func formatJSONArray(entries []json.RawMessage) ([]byte, error) {
	root := jsonNode{values: make([]jsonNode, len(entries))}
	for i, entry := range entries {
		node, err := parseJSON(entry)
		if err != nil {
			return nil, err
		}
		root.values[i] = node
	}
	var out bytes.Buffer
	printJSON(&out, root, 0, 0, false)
	out.WriteByte('\n')
	return out.Bytes(), nil
}

// formatJSONFile prints one data file the way oxfmt formats it, by the same
// rules as formatJSONArray, so a photo, album or tag file the app commits
// passes the formatting check. JSON it can't read comes back as it is.
func formatJSONFile(content []byte) []byte {
	node, err := parseJSON(content)
	if err != nil {
		return content
	}
	var out bytes.Buffer
	printJSON(&out, node, 0, 0, false)
	out.WriteByte('\n')
	return out.Bytes()
}

func parseJSON(data []byte) (jsonNode, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	node, err := parseValue(dec)
	if err != nil {
		return jsonNode{}, err
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return jsonNode{}, errors.New("trailing data after JSON value")
	}
	return node, nil
}

func parseValue(dec *json.Decoder) (jsonNode, error) {
	tok, err := dec.Token()
	if err != nil {
		return jsonNode{}, err
	}
	switch v := tok.(type) {
	case json.Delim:
		return parseContainer(dec, v == '{')
	case string:
		return jsonNode{scalar: quoteJSON(v)}, nil
	case json.Number:
		return jsonNode{scalar: v.String()}, nil
	case bool:
		if v {
			return jsonNode{scalar: "true"}, nil
		}
		return jsonNode{scalar: "false"}, nil
	default:
		return jsonNode{scalar: "null"}, nil
	}
}

// parseContainer reads an object's or array's members, up to its closing
// delimiter.
func parseContainer(dec *json.Decoder, isObject bool) (jsonNode, error) {
	node := jsonNode{isObject: isObject, values: []jsonNode{}}
	for dec.More() {
		if isObject {
			tok, err := dec.Token()
			if err != nil {
				return jsonNode{}, err
			}
			key, _ := tok.(string)
			node.keys = append(node.keys, key)
		}
		value, err := parseValue(dec)
		if err != nil {
			return jsonNode{}, err
		}
		node.values = append(node.values, value)
	}
	if _, err := dec.Token(); err != nil {
		return jsonNode{}, err
	}
	return node, nil
}

// quoteJSON quotes s as jq does, leaving <, > and & as they are.
func quoteJSON(s string) string {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(s)
	return strings.TrimSuffix(b.String(), "\n")
}

func (n jsonNode) isContainer() bool { return n.scalar == "" }

// inline is n on one line, or "" when n can't be printed on one line: a
// non-empty object, or an array holding one.
func (n jsonNode) inline() string {
	if !n.isContainer() {
		return n.scalar
	}
	if len(n.values) == 0 {
		if n.isObject {
			return "{}"
		}
		return "[]"
	}
	if n.isObject {
		return ""
	}
	parts := make([]string, len(n.values))
	for i, v := range n.values {
		if parts[i] = v.inline(); parts[i] == "" {
			return ""
		}
	}
	return "[" + strings.Join(parts, ", ") + "]"
}

// printJSON prints n starting at column col of a line indented by depth
// levels; comma says a comma follows it on the same line.
func printJSON(out *bytes.Buffer, n jsonNode, depth, col int, comma bool) {
	tail := 0
	if comma {
		tail = 1
	}
	line := n.inline()
	// A plain value or an empty one can't break, so it's printed whatever its width.
	fits := line != "" && col+utf8.RuneCountInString(line)+tail <= printWidth
	if fits || !n.isContainer() || len(n.values) == 0 {
		out.WriteString(line)
		return
	}
	opening, closing := "[", "]"
	if n.isObject {
		opening, closing = "{", "}"
	}
	inner := strings.Repeat("  ", depth+1)
	out.WriteString(opening + "\n")
	for i, v := range n.values {
		out.WriteString(inner)
		prefix := len(inner)
		if n.isObject {
			key := quoteJSON(n.keys[i]) + ": "
			out.WriteString(key)
			prefix += utf8.RuneCountInString(key)
		}
		last := i == len(n.values)-1
		printJSON(out, v, depth+1, prefix, !last)
		if !last {
			out.WriteByte(',')
		}
		out.WriteByte('\n')
	}
	out.WriteString(strings.Repeat("  ", depth) + closing)
}
