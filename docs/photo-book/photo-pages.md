# Photo book Photo Pages

The **Photo Pages** tab holds every photo page made for the book, so other ways of laying out the same photos can be tried side by side, such as one run of pages sorted by place and another by theme. **Add page** at the end asks for the new page's layout:

- **Full page:** one photo over the page, the title above it and its caption under it.
- **Two photos on the left:** two photos down the left side, each with its caption beside it on the right, toward the gap between them (the top one low beside its photo, under the title; the bottom one at its photo's top), as the printed books have them.
- **Two photos on the right:** the same, mirrored: photos on the right, captions on the left.
- **Two portrait photos, info on the right:** one row of three columns: the two portrait photos side by side, then an info column with the title and both captions, in the photos' order.
- **Two portrait photos, info on the left:** the same, mirrored: info, photo 1, photo 2.

Each photo place keeps its shape whatever room the page gives it: 3:2 for the landscape places, 2:3 for the portrait ones, as large as fits, with the photo cropped to fill it.

> **Frontend analogy:** each place is a CSS size container (`container-type: size`) whose photo is `min(100cqw, 150cqh)` wide with `aspect-ratio: 3 / 2`, so it's as big as it can be without stretching, whichever side runs out first. Each photo loads the smallest of its resized versions that's at least as wide as it's drawn, times the screen's pixel density, so the large preview on **The book** stays sharp and the small ones stay light.

> **Frontend analogy:** that's `srcset` with `w` descriptors and a `sizes` set from the place's measured width (a `ResizeObserver`), rather than one fixed thumbnail URL.

Pages have no numbers here. Above each page, its name, typed in (**Untitled page** until it has one), its layout's buttons (to switch it; a photo past the new layout's places comes off the page), the **H** button that adds or takes off a title (typed on the page itself), and the bin that removes it. Clicking a caption types over it.

**Move to…** on each photo page or spread in **Edit pages** moves it to a position you type among the photo pages, 1 first, a spread moving as one; a number past either end puts it first or last. Like dragging, it doesn't change the book's own order.

**Sort by book order**, beside the views, puts the photo pages in the order **The book** has them, the ones not in the book after them in the order they were; it says **In book order** once they are. **Show pages in the book**, on to start, can be turned off to see only the pages and spreads not in the book yet. Both show only once something is in the book.

**Edit pages** and **Grid to reorder**, above the pages, switch views. The grid shows every photo page and spread as a small preview, numbered in order and marked **In book**; drag one onto another to put it before that one, or onto the box at the end. A spread moves as one, and the book's own order (on **The book**) doesn't change. Clicking one opens **Edit pages** scrolled to it, and clicking its number opens **Move to…**. Check two or more with the box by their names and **Set as alternates**, above the grid, puts them in one alternates group, bringing along any group one was already in.

Two round buttons at the bottom right scroll smoothly to either end of the page: **Jump to bottom**, shown while the page is more than a little way from its end, and **Back to top** above it, shown once it's scrolled down a little. They're the portfolio's **Back to top** button, which can go either way. A second **Add page**, at the right end of the row above the pages, adds a page the same way as the one at the end and scrolls down to it.

## Alternates

**Alternates**, above each page or spread, makes others alternates of it: two or more versions of the same part of the book, grouped and lettered (**Alternate A**). Its flyout lists the group; **Pick** keeps that one and hides the others from Photo Pages (they're kept, marked **Alternate A · hidden**), and in the book the picked one takes the place of the first of its group there, the others coming out. **Show hidden alternates**, beside the views, shows the hidden ones again, to pick another; **Show all again** undoes the pick; **Leave group** takes one out (a group left with one ends). A spread is an alternate as one.

## Text pages

**Text page**, in the **Add page** picker after the built-in layouts and among each page's layout buttons, makes a page that isn't built around photos: a title and text. Click the text to write it, in Markdown (**bold**, _italic_, `#` headings, `-` lists, `>` quotes; each line break is kept), and click away to see it drawn. **Columns**, at the page's bottom right while editing, flows the text into 1 to 3 columns, reflowing from one to the next. **Photos** gives the page up to 4 photo places in a row under the text, each with its caption under it, filled from the drawer like any page's; taking a place away takes its photo off. **Text**, beside them once the page has photos, puts the text **Above** the photos (to start), or beside them on the **Left** or **Right**: the title and text then take one side of the page and the photos the other, stacked in one column, or two for 3 or 4 photos. A page switched to **Text page** keeps its photos, and its title and text show only on a text page. Text pages are photo pages in every other way: they link into spreads, take tags and alternates, go in the book, and print in the PDF as drawn. The **Text pages** filter in the Book tab's drawer finds them.

> **Frontend analogy:** the text is a controlled `<textarea>` while editing and `react-markdown` output otherwise, in a box with CSS `column-count`, so the browser does the reflow. The PDF prints the rendered Markdown, not the textarea.

## Spreads

**Link with next page**, above a page, links it with the photo page after it into a two-page spread, shown side by side across the row with **Unlink** above it; a spread's pages always follow each other, so the arrows beside it move the page or the whole spread one place earlier or later among the photo pages, to line up the two to link. A page before a spread can't link to it. **In book** marks a page or spread that's in the book. Its tags show beside that as chips (the × takes one off), and **Add tag** opens a flyout with this book's tags to add with a click and a box for a new one. Tags belong to the book: the ones offered are the ones on its pages, and no other book shares them. Removing one page of a spread leaves the other on its own, in the book where the spread was.
