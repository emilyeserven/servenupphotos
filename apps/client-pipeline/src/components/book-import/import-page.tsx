import { useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { AnswerCard } from "@/components/book-import/answer-card";
import { PromptCard } from "@/components/book-import/prompt-card";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { DecidedPhotoFiles } from "@/components/photo-files";
import { type BookSource, type CatalogDates, catalogPhotos } from "@/lib/book-import-prompt";

/**
 * Photo Books › Import Book: copies a prompt that has an LLM read a photo book made before (a PDF,
 * or images of its pages) against a catalog of the website's photos, and turns its answer into an
 * album and a photo book.
 */
export function ImportBookPage() {
  return (
    <Page
      wide
      title="Import Book"
      description="Rebuild a photo book you made before. Send an LLM a PDF of it, or images of its pages, with the prompt below; it matches the book's photos to the website's, says which aren't on the website, and lays out each page. Its answer makes an album of the matched photos and a photo book with the same pages."
    >
      <GitHubGate>
        {() => <DecidedPhotoFiles>{(photos) => <ImportBook photos={photos} />}</DecidedPhotoFiles>}
      </GitHubGate>
    </Page>
  );
}

/** The prompt, limited to the photos taken between the dates, and the box its answer goes in. */
function ImportBook({ photos }: { photos: SocialPhoto[] }) {
  const [source, setSource] = useState<BookSource>("pdf");
  const [dates, setDates] = useState<CatalogDates>({ from: "", to: "" });
  const catalog = catalogPhotos(photos, dates);
  return (
    <>
      <PromptCard
        source={source}
        onSource={setSource}
        dates={dates}
        onDates={setDates}
        catalog={catalog}
      />
      <AnswerCard photos={photos} />
    </>
  );
}
