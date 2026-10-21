# Pocket Notes for iPhone

A web app you add to your iPhone's home screen. It reads and writes the same note files as the
desktop app. They live in **Dropbox › Apps › Pocket Notes MK**, and go straight between the phone
and Dropbox.

Live at https://mkellogg98.github.io/pocket-notes/

## What it does

- Lists your notes: pinned first, with folders and search (including `#tags`). Tap one to edit it.
- Two ways to view a note, switched with the button at the top (it remembers your choice):
  - **Canvas:** laid out like on the computer. The note text is on the left; swipe to reach the text
    boxes and pictures. Pinch or use − / + to zoom, and tap the % to go back to 100%.
    - Drag a text box by its top bar, and drag the round handle to resize it.
    - Tap a picture to select it, then drag it to move it.
    - Double-tap empty space to add a text box there.
  - **List:** text boxes and pictures are shown one after another under the note.
- Formatting: bold, italic, underline, strikethrough, checklists (tap the box), bullet and numbered lists.
- Text boxes from the desktop canvas show under the note, and you can add new ones. On the computer,
  new ones appear to the right of the note text.
- Pictures show up, and you can add one from your camera roll. It's saved in the note's attachments folder.
- Pip comes along, with his built-in remarks; the AI ones need the computer.
  - He wanders, visits text boxes and pictures, and reads titles.
  - While you type, he keeps to the strip under the top bar, away from your line.
  - His bed is a tiny nest next to the sync status. He walks up to it getting smaller, as if into
    the distance, then naps there with z's and still talks.
  - Tap the nest to send him there or call him out, and drag him wherever you like.
  - Turn him off in Settings › Pip.
  - `pip.js` is the desktop app's `ui/pip.js` (one copy, kept in step).
- The formatting bar is part of the note screen, which is sized to what's visible above the keyboard,
  so it stays right on top of it (including browser bars like Chrome's).
- Tags, folder, color, pin and delete. Deleted notes go to `Pocket Notes\Trash`, like on the computer.
- Works offline: notes are kept on the phone, and edits are sent when you're back online.
- If a note was changed on both devices before they synced, nothing is lost. The phone's version is
  saved as "<title> (phone copy)".

The desktop app checks for changes every 20 seconds while it's open, and whenever you switch back to it.

## Setup (done once)

1. Dropbox App Console (https://www.dropbox.com/developers/apps): a **Scoped access** app with
   **App folder** access, named `Pocket Notes MK` ("Pocket Notes" was taken). It's free and needs no card.
   - **Permissions:** `files.metadata.read`, `files.content.read`, `files.content.write`.
   - **Redirect URIs:** `https://mkellogg98.github.io/pocket-notes/` and `http://localhost:8800/`.
   - **Allow public clients (Implicit Grant & PKCE):** Allow.
2. Put the app key in `config.js` (`appKey`). It isn't a secret.
3. The desktop app's notes folder is set to `Dropbox\Apps\Pocket Notes MK` (`notesFolder` in its settings).
4. On the iPhone, open the address in **Safari**, sign in, then tap **Share › Add to Home Screen**.

Dropbox keeps the phone signed in until you sign out.

## Testing on the computer

`?mock=<port>` on `localhost` uses a stand-in for Dropbox instead of signing in.
