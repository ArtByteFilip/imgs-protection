# Encrypted Image Gallery

A simple Node.js application for uploading, storing, and viewing images in an encrypted gallery with basic authentication.

## Features

- Upload multiple images securely.
- Images are encrypted and stored locally.
- Basic authentication required to access the gallery.
- Responsive gallery UI with lightbox preview.

## Requirements

- Node.js (v16 or newer)
- npm

## Installation

1. Clone or download this repository.
2. Install dependencies:

   ```
   npm install formidable
   ```

## Usage

1. Start the server:

   ```
   node index.js
   ```

2. Enter your gallery key when prompted (used for authentication).

3. Open your browser and go to:

   ```
   http://localhost:3333
   ```

4. Log in with any username and the gallery key as the password.

## Notes

- Uploaded images are encrypted and stored in `data.json`.
- Encryption keys are stored in `key.json`.
- No copyright