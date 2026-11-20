package github

import (
	"strings"
	"testing"
)

func TestSetGenreTree(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/genres/architecture.json"] = "{\n  \"id\": \"architecture\",\n  \"name\": \"Architecture\",\n  \"description\": \"\"\n}\n"
	f.files["main:data/genres/temples.json"] = "{\n  \"id\": \"temples\",\n  \"name\": \"Temples\",\n  \"description\": \"\"\n}\n"
	f.files["main:data/genres/street.json"] = "{\n  \"id\": \"street\",\n  \"name\": \"Street\",\n  \"description\": \"\"\n}\n"
	f.files["main:data/tags/night.json"] = "{\n  \"id\": \"night\",\n  \"name\": \"night\",\n  \"description\": \"\"\n}\n"

	got, err := c.SetGenreTree(t.Context(), organizeGH, []GenreTreeEntry{
		{ID: "street", Name: "Street"},
		{ID: "architecture", Name: "Architecture"},
		{ID: "temples", Name: " Traditional architecture ", Parent: "architecture"},
	})
	if err != nil {
		t.Fatalf("SetGenreTree() error = %v", err)
	}
	if got.Files != 3 {
		t.Errorf("SetGenreTree() files = %d, want 3", got.Files)
	}
	content, _ := stagedContent(t, c, "data/genres/temples.json")
	for _, want := range []string{`"id": "temples"`, `"name": "Traditional architecture"`, `"parent": "architecture"`, `"order": 3`} {
		if !strings.Contains(content.Content, want) {
			t.Errorf("temples.json = %q, want %s", content.Content, want)
		}
	}
	if content, _ := stagedContent(t, c, "data/genres/street.json"); strings.Contains(content.Content, "parent") {
		t.Errorf("street.json = %q, want no parent written for a genre that stays at the top", content.Content)
	}

	organized, err := c.Organize(t.Context(), organizeGH)
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, g := range organized.Genres {
		ids = append(ids, g.ID+">"+g.Parent)
	}
	if strings.Join(ids, ",") != "street>,architecture>,temples>architecture" {
		t.Errorf("Genres = %v, want them in the saved order with temples under architecture", ids)
	}
}

func TestSetGenreTreeRefuses(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/genres/architecture.json"] = "{\n  \"id\": \"architecture\",\n  \"name\": \"Architecture\"\n}\n"
	f.files["main:data/genres/temples.json"] = "{\n  \"id\": \"temples\",\n  \"name\": \"Temples\"\n}\n"
	f.files["main:data/tags/night.json"] = "{\n  \"id\": \"night\",\n  \"name\": \"night\"\n}\n"

	arch := GenreTreeEntry{ID: "architecture", Name: "Architecture"}
	for name, entries := range map[string][]GenreTreeEntry{
		"empty":         nil,
		"left out":      {arch},
		"twice":         {arch, arch},
		"not a genre":   {arch, {ID: "temples", Name: "Temples"}, {ID: "macro", Name: "Macro"}},
		"no name":       {arch, {ID: "temples", Name: " "}},
		"same name":     {arch, {ID: "temples", Name: "architecture"}},
		"tag's name":    {arch, {ID: "temples", Name: "Night"}},
		"no parent":     {arch, {ID: "temples", Name: "Temples", Parent: "buildings"}},
		"loop":          {{ID: "architecture", Name: "Architecture", Parent: "temples"}, {ID: "temples", Name: "Temples", Parent: "architecture"}},
		"inside itself": {arch, {ID: "temples", Name: "Temples", Parent: "temples"}},
	} {
		if _, err := c.SetGenreTree(t.Context(), organizeGH, entries); err == nil {
			t.Errorf("SetGenreTree(%s) error = nil, want one", name)
		}
	}
	if _, ok := stagedContent(t, c, "data/genres/temples.json"); ok {
		t.Error("SetGenreTree() saved a change it refused")
	}
}

func TestCreateSubgenre(t *testing.T) {
	_, c := newFakeGitHub(t)
	for _, g := range []NewGroup{{ID: "architecture", Name: "Architecture"}, {ID: "temples", Name: "Temples", Parent: "architecture"}} {
		if _, err := c.CreateGroup(t.Context(), organizeGH, Genres, g); err != nil {
			t.Fatalf("CreateGroup(%s) error = %v", g.ID, err)
		}
	}
	if content, _ := stagedContent(t, c, "data/genres/temples.json"); !strings.Contains(content.Content, `"parent": "architecture"`) {
		t.Errorf("temples.json = %q, want parent architecture", content.Content)
	}
	got, err := c.SetGroupParent(t.Context(), organizeGH, Genres, "temples", "")
	if err != nil || !got.Changed {
		t.Fatalf("SetGroupParent(temples, none) = %+v, %v; want it changed", got, err)
	}
}
