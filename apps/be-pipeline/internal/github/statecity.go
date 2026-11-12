package github

import (
	"encoding/json"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
)

// addCity lists l, a city localization, among the cities a state can be
// named like, by its name and each of its other names.
func (n LocationNames) addCity(l Localization) {
	n.cities[nameKey(l.Name)] = l.Name
	for _, other := range l.OtherNames {
		n.cities[nameKey(other)] = l.Name
	}
}

// cityOfState is the city named like state, such as Seoul for the state
// Seoul, ignoring case, and whether there is one. A city counts when it has a
// localization (one added on the Places page, or one written on the
// Localizations page).
func (n LocationNames) cityOfState(state string) (string, bool) {
	if strings.TrimSpace(state) == "" {
		return "", false
	}
	city, ok := n.cities[nameKey(state)]
	return city, ok
}

// fillCity is s with its city filled in when it has a state but no city and
// the state is named like a city: a custom state fills in the custom city,
// and otherwise the EXIF state fills in the EXIF city. A photo with either
// city already is left as it is.
func (n LocationNames) fillCity(s exif.Sanitized) exif.Sanitized {
	if filled(s.City) || filled(s.CustomCity) {
		return s
	}
	if filled(s.CustomState) {
		if city, ok := n.cityOfState(*s.CustomState); ok {
			s.CustomCity = &city
		}
		return s
	}
	if s.State != nil {
		if city, ok := n.cityOfState(*s.State); ok {
			s.City = &city
		}
	}
	return s
}

// filled reports whether value is a name with more than spaces in it.
func filled(value *string) bool {
	return value != nil && strings.TrimSpace(*value) != ""
}

// cityFromState is the change fillCity makes to a photo file's top-level
// fields, after the renames in changes, or nil when it makes none.
func (n LocationNames) cityFromState(fields map[string]json.RawMessage, changes []FieldChange) []FieldChange {
	value := func(field string) *string {
		raw := fields[field]
		for _, ch := range changes {
			if ch.Field == field {
				raw = ch.To
			}
		}
		var name *string
		if json.Unmarshal(raw, &name) != nil {
			return nil
		}
		return name
	}
	before := exif.Sanitized{
		City: value("city"), CustomCity: value("customCity"), State: value("state"), CustomState: value("customState"),
	}
	after := n.fillCity(before)
	field, city := "city", after.City
	if after.CustomCity != before.CustomCity {
		field, city = "customCity", after.CustomCity
	} else if after.City == before.City {
		return nil
	}
	to, _ := json.Marshal(*city)
	return []FieldChange{{Field: field, From: compactOrNull(fields[field]), To: to}}
}
