package github

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// GenreTreeEntry is one genre as the Reorganize Genres page arranges it: its
// name and the genre it's a subgenre of.
type GenreTreeEntry struct {
	// ID is the genre's ID, which photos list it by; it never changes here.
	ID string `json:"id"`
	// Name is the genre's name as shown, such as "Traditional architecture".
	Name string `json:"name"`
	// Parent is the ID of the genre this one is a subgenre of, such as
	// "architecture", or empty for a top-level genre.
	Parent string `json:"parent"`
}

// SetGenreTree saves entries, every genre in its new order, as each genre
// file's "order" (1 first), "parent" and "name", in the pending changes. A
// genre keeps its ID, so the photos that list it keep it. Nothing is saved
// when an entry isn't a genre, a genre is left out or listed twice, a name is
// empty, too long or taken, a parent isn't one of the genres, or the parents
// go round in a loop.
func (c *Client) SetGenreTree(ctx context.Context, gh settings.GitHub, entries []GenreTreeEntry) (AlbumsResult, error) {
	if len(entries) == 0 {
		return AlbumsResult{}, publishErr(http.StatusBadRequest, "List every genre in its new order to save it.")
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	groups := w.groups()
	genres, perr := genreTreeGroups(groups[Genres.Folder], entries)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	if perr := checkGenreTree(groups, entries); perr != nil {
		return AlbumsResult{}, perr
	}
	edits := make([]albumEdit, 0, 3*len(entries))
	for i, e := range entries {
		edits = append(edits, genreTreeEdits(genres[i], e, i+1)...)
	}
	return c.saveAlbumEdits(w, edits)
}

// genreTreeGroups is the genre of each entry, in order, failing when one isn't
// a readable genre, is listed twice, or a genre is left out.
func genreTreeGroups(genres []Group, entries []GenreTreeEntry) ([]Group, *PublishError) {
	out := make([]Group, 0, len(entries))
	seen := map[string]bool{}
	for i := range entries {
		entries[i].ID = strings.TrimSpace(entries[i].ID)
		g, perr := readableGroup(Genres, genres, entries[i].ID)
		if perr != nil {
			return nil, perr
		}
		if seen[g.ID] {
			return nil, publishErr(http.StatusBadRequest, "%q is in the list twice.", g.ID)
		}
		seen[g.ID] = true
		out = append(out, g)
	}
	for _, g := range genres {
		if !seen[g.ID] && g.Error == "" {
			return nil, publishErr(http.StatusConflict, "The list leaves out the genre %q. Refresh to see every genre, then save again.", g.ID)
		}
	}
	return out, nil
}

// checkGenreTree fails when an entry's name is empty, too long, used twice or
// taken by an album or tag, or its parent isn't another listed genre, or the
// parents go round in a loop. It trims the names and parents in place.
func checkGenreTree(groups map[string][]Group, entries []GenreTreeEntry) *PublishError {
	parents := map[string]string{}
	for i := range entries {
		entries[i].Parent = strings.TrimSpace(entries[i].Parent)
		parents[entries[i].ID] = entries[i].Parent
	}
	names := map[string]string{}
	for i := range entries {
		e := &entries[i]
		e.Name = strings.TrimSpace(e.Name)
		if perr := checkGenreName(groups, names, *e); perr != nil {
			return perr
		}
		names[strings.ToLower(e.Name)] = e.ID
		if _, ok := parents[e.Parent]; e.Parent != "" && !ok {
			return publishErr(http.StatusBadRequest, "There's no genre with the ID %q to put %q under.", e.Parent, e.Name)
		}
	}
	return checkGenreLoops(entries, parents)
}

// checkGenreName fails when e's name is empty, too long, already given to
// another entry in names (lowercase name to ID), or, when it's new, an
// album's or tag's name.
func checkGenreName(groups map[string][]Group, names map[string]string, e GenreTreeEntry) *PublishError {
	switch {
	case e.Name == "":
		return publishErr(http.StatusBadRequest, "Give the genre %q a name.", e.ID)
	case utf8.RuneCountInString(e.Name) > maxGroupNameLength:
		return publishErr(http.StatusBadRequest, "Keep the name of %q to %d characters.", e.ID, maxGroupNameLength)
	case names[strings.ToLower(e.Name)] != "":
		return publishErr(http.StatusBadRequest, "Two genres are named %q. Give each its own name.", e.Name)
	}
	if current, ok := findGroup(groups[Genres.Folder], e.ID); ok && current.Name == e.Name {
		// Unchanged names were checked when they were given.
		return nil
	}
	for _, k := range []Kind{Albums, Tags} {
		for _, g := range groups[k.Folder] {
			if strings.EqualFold(strings.TrimSpace(g.Name), e.Name) || strings.EqualFold(g.ID, e.Name) {
				return publishErr(http.StatusConflict, "The %s %q already has the name %q. Pick another name for the genre.", k.Name, g.ID, e.Name)
			}
		}
	}
	return nil
}

// checkGenreLoops fails when following parents from an entry comes back round
// to a genre already passed, such as a genre under its own subgenre.
func checkGenreLoops(entries []GenreTreeEntry, parents map[string]string) *PublishError {
	for _, e := range entries {
		seen := map[string]bool{}
		for at := e.ID; at != ""; at = parents[at] {
			if seen[at] {
				return publishErr(http.StatusBadRequest, "%q ends up inside itself. Move it, or the genre over it, somewhere else.", e.Name)
			}
			seen[at] = true
		}
	}
	return nil
}

// genreTreeEdits are the edits that give genre e's name and parent and the
// place order, leaving out the name and parent when they're already so.
func genreTreeEdits(genre Group, e GenreTreeEntry, order int) []albumEdit {
	edits := []albumEdit{{album: genre, key: orderKey, value: []byte(strconv.Itoa(order))}}
	if e.Parent != genre.Parent {
		value := []byte("null")
		if e.Parent != "" {
			value = []byte(quoteJSON(e.Parent))
		}
		edits = append(edits, albumEdit{album: genre, key: parentKey, value: value})
	}
	if e.Name != genre.Name {
		edits = append(edits, albumEdit{album: genre, key: groupNameKey, value: []byte(quoteJSON(e.Name))})
	}
	return edits
}
