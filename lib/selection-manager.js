const { CompositeDisposable, Emitter } = require("atom");
const SearchModel = require("./search-model");

function debounce(fn, wait) {
  let timeout;
  const debounced = function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
  debounced.clear = () => clearTimeout(timeout);
  return debounced;
}

module.exports = class SelectionManager {
  constructor() {
    this.debouncedHandleSelection = this.debouncedHandleSelection.bind(this);
    this.searchModel = new SearchModel(this);
    this.emitter = new Emitter();
    this.editorToMarkerLayerMap = {};
    this.resultCount = 0;
    this.handleSelectionDebounce = null;

    this.editorSubscriptions = new CompositeDisposable();
    this.editorSubscriptions.add(
      atom.workspace.observeTextEditors((editor) => {
        this.setupMarkerLayers(editor);
      }),
    );

    this.editorSubscriptions.add(
      atom.workspace.onWillDestroyPaneItem((item) => {
        if (atom.workspace.isTextEditor(item.item)) {
          const editor = item.item;
          this.removeMarkers(editor.id);
          this.destroyMarkerLayers(editor.id);
          delete this.editorToMarkerLayerMap[editor.id];
        }
      }),
    );

    this.enable();
    this.listenForTimeoutChange();
    this.activeItemSubscription = atom.workspace.onDidChangeActivePaneItem(() => {
      this.debouncedHandleSelection();
      this.subscribeToActiveTextEditor();
    });
    this.subscribeToActiveTextEditor();
  }

  destroy() {
    if (this.handleSelectionDebounce) {
      this.handleSelectionDebounce.clear();
    }
    if (this.activeItemSubscription) {
      this.activeItemSubscription.dispose();
    }
    if (this.selectionSubscription) {
      this.selectionSubscription.dispose();
    }
    if (this.editorSubscriptions) {
      this.editorSubscriptions.dispose();
    }
    if (this.timeoutSubscription) {
      this.timeoutSubscription.dispose();
    }
    if (this.emitter) {
      this.emitter.dispose();
    }
    Object.keys(this.editorToMarkerLayerMap).forEach((editorId) => {
      this.destroyMarkerLayers(editorId);
    });
    this.editorToMarkerLayerMap = {};
  }

  destroyMarkerLayers(editorId) {
    const layers = this.editorToMarkerLayerMap[editorId];
    if (!layers) return;
    if (layers.decoration) layers.decoration.destroy();
    if (layers.markerLayer) layers.markerLayer.destroy();
  }

  onDidFinishAddingMarkers(callback) {
    return this.emitter.on("did-finish-adding-markers", callback);
  }

  onDidRemoveAllMarkers(callback) {
    return this.emitter.on("did-remove-all-markers", callback);
  }

  disable() {
    this.disabled = true;
    this.removeAllMarkers();
  }

  enable() {
    this.disabled = false;
    this.debouncedHandleSelection();
  }

  debouncedHandleSelection() {
    if (!this.handleSelectionDebounce) {
      this.handleSelectionDebounce = debounce(() => {
        this.searchModel.handleSelection();
      }, atom.config.get("highlight-simple.timeout"));
    }
    this.handleSelectionDebounce();
  }

  listenForTimeoutChange() {
    this.timeoutSubscription = atom.config.onDidChange("highlight-simple.timeout", () => {
      if (this.handleSelectionDebounce) {
        this.handleSelectionDebounce.clear();
      }
      this.handleSelectionDebounce = null;
      this.debouncedHandleSelection();
    });
  }

  subscribeToActiveTextEditor() {
    if (this.selectionSubscription) {
      this.selectionSubscription.dispose();
    }

    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return;

    this.selectionSubscription = new CompositeDisposable();
    this.selectionSubscription.add(editor.onDidAddSelection(this.debouncedHandleSelection));
    this.selectionSubscription.add(editor.onDidChangeSelectionRange(this.debouncedHandleSelection));
  }

  removeAllMarkers() {
    Object.keys(this.editorToMarkerLayerMap).forEach((editorId) => {
      this.removeMarkers(editorId);
    });
    this.resultCount = 0;
    this.emitter.emit("did-remove-all-markers");
  }

  removeMarkers(editorId) {
    const layers = this.editorToMarkerLayerMap[editorId];
    if (!layers || !layers.markerLayer) return;
    layers.markerLayer.clear();
  }

  goToNext() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return;

    const layers = this.editorToMarkerLayerMap[editor.id];
    if (!layers || !layers.markerLayer) return;

    const markers = layers.markerLayer.getMarkers();
    if (markers.length === 0) return;

    markers.sort((a, b) => {
      const ar = a.getBufferRange();
      const br = b.getBufferRange();
      return ar.start.row - br.start.row || ar.start.column - br.start.column;
    });

    const selRange = editor.getSelectedBufferRange();
    let next = markers.find((m) => {
      const r = m.getBufferRange();
      return (
        r.start.row > selRange.end.row ||
        (r.start.row === selRange.end.row && r.start.column >= selRange.end.column)
      );
    });

    if (!next) next = markers[0];

    const range = next.getBufferRange();
    editor.setSelectedBufferRange(range);
    editor.scrollToBufferPosition(range.start, { center: true });
  }

  goToPrevious() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return;

    const layers = this.editorToMarkerLayerMap[editor.id];
    if (!layers || !layers.markerLayer) return;

    const markers = layers.markerLayer.getMarkers();
    if (markers.length === 0) return;

    markers.sort((a, b) => {
      const ar = a.getBufferRange();
      const br = b.getBufferRange();
      return ar.start.row - br.start.row || ar.start.column - br.start.column;
    });

    const selRange = editor.getSelectedBufferRange();
    let prev = null;
    for (let i = markers.length - 1; i >= 0; i--) {
      const r = markers[i].getBufferRange();
      if (
        r.end.row < selRange.start.row ||
        (r.end.row === selRange.start.row && r.end.column <= selRange.start.column)
      ) {
        prev = markers[i];
        break;
      }
    }

    if (!prev) prev = markers[markers.length - 1];

    const range = prev.getBufferRange();
    editor.setSelectedBufferRange(range);
    editor.scrollToBufferPosition(range.start, { center: true });
  }

  setupMarkerLayers(editor) {
    this.destroyMarkerLayers(editor.id);

    const markerLayer = editor.addMarkerLayer();
    const decoration = editor.decorateMarkerLayer(markerLayer, {
      type: "highlight",
      class: "highlight-simple",
    });

    this.editorToMarkerLayerMap[editor.id] = { markerLayer, decoration };
  }
};
