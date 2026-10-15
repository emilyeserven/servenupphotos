// Command api runs the be-pipeline HTTP server.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/httpapi"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func main() {
	addr := ":" + getenv("PORT", "8081")
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	// Without exiftool the server still runs; only POST /exif is unavailable.
	var extractor exif.Extractor
	if et, err := exif.NewExiftool(); err != nil {
		logger.Warn("exiftool unavailable; POST /exif will respond 503", "err", err)
	} else {
		defer et.Close() //nolint:errcheck // process exit
		extractor = et
	}

	store := settings.NewStore(getenv("SETTINGS_FILE", "data/settings.json"))

	srv := &http.Server{
		Addr:              addr,
		Handler:           httpapi.NewRouter(extractor, store),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("be-pipeline listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown error", "err", err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
