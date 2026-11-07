package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// registerCameraRoutes adds the routes for camera overrides, combined into
// CAMERAS.json, custom lenses, combined into LENSES.json, and the cameras' and
// lenses' own pictures, combined into GEAR.json.
func registerCameraRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /cameras/{id}", handleSaveCameraOverride(d.store, d.gh))
	mux.HandleFunc("DELETE /cameras/{id}", handleDeleteCameraOverride(d.store, d.gh))
	mux.HandleFunc("PUT /lenses/{id}", handleSaveCustomLens(d.store, d.gh))
	mux.HandleFunc("DELETE /lenses/{id}", handleDeleteCustomLens(d.store, d.gh))
	mux.HandleFunc("POST /gear/image", handleUploadGearImage(d.store.R2, storage.UploadGearOriginal))
	mux.HandleFunc("POST /gear/crop", handleCropGearImage(d.store.R2, storage.CropGearImage))
	mux.HandleFunc("PUT /gear/{id}", handleSaveGear(d.store, d.gh))
	mux.HandleFunc("DELETE /gear/{id}", handleDeleteGear(d.store, d.gh))
}
