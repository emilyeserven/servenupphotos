package github

import (
	"reflect"
	"strings"
)

// combinedKind is one kind of combined data: a folder of data files and the
// combined list Commit builds from them.
type combinedKind struct {
	// name is the kind's key in the API's answers (CombinedFiles,
	// InFlightResult), in the snapshot query and in Commit's counts.
	name string
	// folder is the data folder's subfolder of the kind's files.
	folder string
	// allFile is the kind's combined list, in its folder.
	allFile string
}

// dataKinds is every kind of combined data, photos first. It is the one list
// of them on the Go side: Commit, the snapshot query, Combined and InFlight
// all go through it. Adding a kind is a line here plus its field in
// CombinedFiles and InFlightResult, and its entry in scripts/data-kinds.json
// for the workflow and `pnpm photos:local` (kinds_test.go checks all three
// match).
var dataKinds = []combinedKind{
	{"photos", PhotosFolder, AllPhotosFile},
	{"albums", Albums.Folder, Albums.AllFile},
	{"tags", Tags.Folder, Tags.AllFile},
	{"genres", Genres.Folder, Genres.AllFile},
	{"places", Places.Folder, Places.AllFile},
	{"localizations", Localizations.Folder, Localizations.AllFile},
	{"metainfo", MetaInfo.Folder, MetaInfo.AllFile},
	{"cameras", Cameras.Folder, Cameras.AllFile},
	{"lenses", Lenses.Folder, Lenses.AllFile},
	{"captions", Captions.Folder, Captions.AllFile},
	{"timeline", Trips.Folder, Trips.AllFile},
	{"likes", ViewerLikesKind.Folder, ViewerLikesKind.AllFile},
	{"triplines", TripLines.Folder, TripLines.AllFile},
	{"graphs", GraphPresets.Folder, GraphPresets.AllFile},
	{"gear", GearKind.Folder, GearKind.AllFile},
	{"notstored", NotStoredKind.Folder, NotStoredKind.AllFile},
	{"photobooks", PhotoBooks.Folder, PhotoBooks.AllFile},
	{"bio", BioKind.Folder, BioKind.AllFile},
}

// combinedKinds is every kind of combined data, photos first.
func combinedKinds() []combinedKind {
	return dataKinds
}

// groupKinds is every kind but photos: the ones InFlightResult lists as
// InFlightGroups.
func groupKinds() []combinedKind {
	return dataKinds[1:]
}

// kindFields is the fields of type T in the struct v points to, by their JSON
// name, which is a kind's name. It lets an answer keep one typed field per
// kind while the code fills them by going through dataKinds.
func kindFields[T any](v any) map[string]*T {
	s := reflect.ValueOf(v).Elem()
	fields := map[string]*T{}
	for i := range s.NumField() {
		if p, ok := s.Field(i).Addr().Interface().(*T); ok {
			fields[jsonName(s.Type().Field(i))] = p
		}
	}
	return fields
}

// jsonName is f's name in JSON, from its json tag.
func jsonName(f reflect.StructField) string {
	name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
	return name
}
