# Typst Figure Gallery

A VS Code extension that provides a gallery view of all `figure()` blocks in your Typst documents. Perfect for managing and reviewing images and captions when writing papers or documents.

## ✨ Features

- 📸 **Automatic Figure Detection**: Automatically finds and displays all `figure()` blocks from Typst files in a gallery
- 🔄 **Real-time Updates**: Changes are reflected in real-time without saving files
- 📁 **Recursive File Parsing**: Automatically collects figures from all files referenced via `#include` or `#import`
- 🔍 **Zoom View**: Click on a card to view the image in a modal with detailed information
- ✏️ **Quick Edit**: Click the "Edit" button in the modal to jump directly to the file where the figure is declared
- 🏷️ **Figure Numbering**: Sequential numbering for easy figure management
- 💬 **Caption Display**: View captions for each figure
- 🚫 **Comment Filtering**: Commented-out figures are automatically excluded

## 📦 Installation

### Install from VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Typst Figure Gallery"
4. Click Install

### Manual Installation

```bash
git clone https://github.com/your-username/typst-figure-gallery.git
cd typst-figure-gallery
npm install
npm run compile
```

Then in VS Code: `Ctrl+Shift+P` → "Extensions: Install from VSIX..." → Select the `.vsix` file

## 🚀 Usage

### Opening the Gallery

1. Open a Typst file
2. Press `Ctrl+Shift+P` (or `F1`) to open the command palette
3. Type "Typst: Open Figure Gallery" and execute

Alternatively, you can set a keyboard shortcut:
- `File` → `Preferences` → `Keyboard Shortcuts`
- Search for "Typst: Open Figure Gallery" and set your preferred shortcut

### Using the Gallery

- **Click Card**: Click on a figure card to view the enlarged image and details in a modal
- **Keyboard Navigation** (when modal is open):
  - `←` / `→`: Navigate to previous/next figure
  - `ESC`: Close modal
  - `E`: Edit in file (jump to the figure declaration location)
- **Edit Button**: Click the "✏️ Edit" button at the bottom of the modal to jump to the file where the figure is declared

## 📝 Typst File Example

```typst
// main.typ
#include "sections/introduction.typ"
#include "sections/methods.typ"

// sections/introduction.typ
#figure(
  image("figures/experiment.png"),
  caption: [Experiment Results Graph]
)

#figure(
  image("figures/diagram.png"),
  caption: [System Architecture Diagram]
)

// sections/methods.typ
#figure(
  image("figures/algorithm.png"),
  caption: [Algorithm Flowchart]
)
```

When you open `main.typ` and run the gallery, all figures from included files will be displayed at once.

## 🎯 How It Works

1. **Main File Detection**: Searches parent directories from the currently open Typst file to find the main file that uses `#include` or `#import`
2. **Recursive Parsing**: Recursively searches the main file and all included files to extract `figure()` blocks
3. **Real-time Updates**: Automatically updates the gallery 300ms after file content changes (no save required)
4. **Memory-based Reading**: Reads open files directly from memory, so changes are reflected even without saving

## 🔧 Requirements

- VS Code 1.90.0 or higher
- Typst files (`.typ` extension)

## 📋 Supported Figure Formats

```typst
// Basic format
#figure(
  image("path/to/image.png"),
  caption: [Caption text]
)

// String caption
#figure(
  image("path/to/image.png"),
  caption: "Caption text"
)

// No caption
#figure(
  image("path/to/image.png")
)
```

## 🚫 Excluded Items

- Commented-out figures:
  ```typst
  // #figure(image("test.png"), caption: [Test])
  
  /*
  #figure(image("test.png"), caption: [Test])
  */
  ```

## 🐛 Troubleshooting

### Figures are not showing in the gallery

1. Check if the file is in the correct path
2. Verify that the `#figure()` block syntax is correct
3. Check if the image file path is correct
4. Make sure the figure is not commented out

### Real-time updates are not working

- Changes are automatically reflected even if the file is not saved, as long as it's open
- Try closing and reopening the gallery panel

## 🤝 Contributing

Bug reports, feature suggestions, and pull requests are welcome!

1. Fork this repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

Thanks to the Typst community and all contributors.

---

**Made with ❤️ for Typst users**
