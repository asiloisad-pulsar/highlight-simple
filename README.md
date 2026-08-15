# highlight-simple

Highlight all occurrences of the selected text in the editor.

![view](https://github.com/asiloisad-pulsar/highlight-simple/blob/master/assets/view.png?raw=true)

Fork of [highlight-selected](https://github.com/Pulsar-Edit-Highlights/selected).

## Features

- **Automatic highlighting**: Highlights all matching occurrences when text is selected.
- **Customizable style**: Override highlight appearance via stylesheet.
- **Scrollmap**: Shows highlight markers in the scrollbar via [scrollmap](https://github.com/asiloisad-pulsar/scrollmap).

## Installation

To install `highlight-simple` search for [highlight-simple](https://web.pulsar-edit.dev/packages/highlight-simple) in the Install pane of the Pulsar settings or run `ppm install highlight-simple`. Alternatively, you can run `ppm install asiloisad-pulsar/highlight-simple` to install a package directly from the GitHub repository.

## Customization

The style can be adjusted according to user preferences in the `styles.less` file:

- e.g. change highlight style:

```less
atom-text-editor .highlights {
  .highlight-simple .region {
    border: 1px solid @syntax-result-marker-color;
    background-color: @syntax-result-marker-color-selected;
    border-radius: 3px;
  }
}
```

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
