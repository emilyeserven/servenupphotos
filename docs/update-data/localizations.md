# Localizations

**Localizations** fills in the [localizations](../places-and-localizations/localizations.md) of up to 50 countries, states, cities and places with one LLM prompt. It lists the names the Localizations page does (from the combined data store and the place files) and counts the ones with no localization, or one without a romanization or local script, the two every name has; pronunciation is only for scripts that don't show it, such as kanji. **Names to ask about** (25 at first, 1 to 50) sets how many **Copy the prompt** (`lib/localization-prompt.ts`) asks about, the ones the most photos show first. Each is listed by its localization ID, with where it is and the fields already saved, asking for the romanization the country uses officially (Revised Romanization, Hepburn with macrons, Pinyin with tone marks), the pronunciation in kana or bopomofo when the script needs it, and the local script, as JSON:

```json
{
  "localizations": [
    { "id": "city-seoul", "romanization": "Seoul", "pronunciation": "", "localScript": "서울" }
  ]
}
```

Paste the answer and **Review the names**. The page reads it itself (`lib/localization-answer.ts`, from the first `{` to the last `}`, so a code block or words around it are fine), with no backend call: each name asked about gets a row like the Localizations page's, with the answer in the fields that are empty and the saved ones kept, to change before saving. The names the answer left out, and the IDs it gave that weren't asked about, are listed under them. Each row's **Save**, or **Save N localizations** for all of them, saves through the same queue as the Localizations page (`PUT /api/localizations/<id>`), as [changes waiting for Commit](../pending-changes.md). Saved names drop out of the count, so copying the prompt again asks about the next ones.

> **Frontend analogy:** it's machine translation for your i18n files: export the keys missing a locale, let a translator fill them in, then import the file back through the same form a person would use.
