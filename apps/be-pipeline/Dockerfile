# syntax=docker/dockerfile:1
# Build context: apps/be-pipeline. Multi-arch friendly (e.g. linux/arm64 for Raspberry Pi).
# The final (default) stage is the production image; the `dev` stage is used by docker-compose.dev.yml.
FROM golang:1.24-alpine AS dev
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
EXPOSE 8081
CMD ["go", "run", "./cmd/api"]

FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
EXPOSE 8081
ENTRYPOINT ["/api"]
