import './style.css';
import Alpine from 'alpinejs';
import { loadIndex, loadTrain, padNumber } from './data.js';
import { clearRoute, focusStop, initMap, setBottomInset, showRoute } from './map.js';

// Below Tailwind's lg breakpoint the details panel is a bottom sheet over the map.
const phone = matchMedia('(max-width: 1023.98px)');
const OPEN_HEIGHT = '85%'; // keep in sync with the sheet's max-h-[85%]
const DRAG_THRESHOLD = 40;

Alpine.data('trainApp', () => ({
  query: '',
  train: null,
  loading: false,
  error: '',
  suggestions: [],
  showPassing: false,
  selected: null,
  sheetOpen: false,
  sheetHeight: null,
  peekPx: 0,
  dragging: false,
  drag: null,
  suppressClick: false,

  init() {
    initMap(this.$refs.map, { attributionPosition: phone.matches ? 'topright' : 'bottomright' });
    if (!phone.matches) document.getElementById('train-number').focus();
    const fromUrl = () => new URLSearchParams(location.search).get('train');
    const start = fromUrl();
    if (start) {
      this.query = start;
      this.search({ updateUrl: false });
    }
    window.addEventListener('popstate', () => {
      const n = fromUrl();
      this.query = n ?? '';
      if (n) this.search({ updateUrl: false });
      else this.reset();
    });
    this.$watch('showPassing', () => this.redraw());
    this.$watch('error', () => this.$nextTick(() => this.measurePeek()));
    phone.addEventListener('change', () => this.measurePeek());
    window.addEventListener('resize', () => this.measurePeek());
    this.$nextTick(() => this.measurePeek());
  },

  // The collapsed sheet shows everything down to the last visible [data-peek] element.
  measurePeek() {
    if (!phone.matches) {
      this.sheetOpen = false;
      this.sheetHeight = null;
      setBottomInset(0);
      return;
    }
    const { sheet, sheetBody } = this.$refs;
    const top = sheet.getBoundingClientRect().top - sheetBody.scrollTop;
    const bottoms = [...sheet.querySelectorAll('[data-peek]')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => el.getBoundingClientRect().bottom - top);
    this.peekPx = Math.ceil(Math.max(0, ...bottoms) + 16);
    if (!this.sheetOpen) this.sheetHeight = `${this.peekPx}px`;
    setBottomInset(this.peekPx);
  },

  openSheet(open) {
    this.sheetOpen = open;
    this.sheetHeight = open ? OPEN_HEIGHT : `${this.peekPx}px`;
    if (!open) this.$refs.sheetBody.scrollTop = 0;
  },

  toggleSheet() {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.openSheet(!this.sheetOpen);
  },

  dragStart(e) {
    if (!phone.matches) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    this.drag = { y: e.clientY, height: this.$refs.sheet.offsetHeight };
  },

  dragMove(e) {
    if (!this.drag) return;
    const dy = e.clientY - this.drag.y;
    if (!this.dragging && Math.abs(dy) < 5) return;
    this.dragging = true;
    const max = this.$refs.sheet.parentElement.clientHeight * 0.85;
    const height = Math.min(max, Math.max(this.peekPx, this.drag.height - dy));
    this.sheetHeight = `${height}px`;
  },

  dragEnd(e) {
    if (!this.drag) return;
    const dy = e.clientY - this.drag.y;
    this.drag = null;
    if (!this.dragging) return; // a tap: the click handler toggles
    this.dragging = false;
    this.suppressClick = true;
    if (dy < -DRAG_THRESHOLD) this.openSheet(true);
    else if (dy > DRAG_THRESHOLD) this.openSheet(false);
    else this.openSheet(this.sheetOpen);
  },

  get visibleStops() {
    if (!this.train) return [];
    return this.train.stops.map((s, i) => ({ ...s, i })).filter((s) => this.showPassing || s.halt);
  },

  get haltCount() {
    return this.train ? this.train.stops.filter((s) => s.halt).length : 0;
  },

  get unmappedCount() {
    return this.train ? this.train.stops.filter((s) => s.halt && s.lat === null).length : 0;
  },

  async suggest() {
    const q = this.query.trim().toLowerCase();
    if (q.length < 2) {
      this.suggestions = [];
      return;
    }
    try {
      const index = await loadIndex();
      this.suggestions = index
        .filter(([number, name]) => number.startsWith(q) || name.toLowerCase().includes(q))
        .slice(0, 20);
    } catch {
      this.suggestions = [];
    }
  },

  async search({ updateUrl = true } = {}) {
    // Suggestions read "12951 — Name", so take the leading digits.
    const digits = this.query.trim().match(/^\d{1,5}/)?.[0];
    if (!digits) {
      this.error = 'Enter a train number of up to 5 digits, for example 12951.';
      return;
    }
    const number = padNumber(digits);
    this.loading = true;
    this.error = '';
    try {
      const train = await loadTrain(number);
      if (!train) {
        this.reset();
        this.error = `No train ${number} in the dataset. It may be new, renumbered, or misspelled.`;
        return;
      }
      this.train = train;
      this.query = number;
      this.selected = null;
      // Collapse the sheet and re-measure it first, so the route is framed above it.
      if (phone.matches) this.openSheet(false);
      await this.$nextTick();
      this.measurePeek();
      this.redraw();
      if (updateUrl && new URLSearchParams(location.search).get('train') !== number) {
        history.pushState(null, '', `?train=${number}`);
      }
      document.title = `${number} ${train.name} · Train Route`;
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  },

  redraw() {
    if (this.train) showRoute(Alpine.raw(this.train), { showPassing: this.showPassing });
  },

  reset() {
    this.train = null;
    this.selected = null;
    clearRoute();
    document.title = 'Train Route';
    this.$nextTick(() => this.measurePeek());
  },

  selectStop(i) {
    this.selected = i;
    if (phone.matches) this.openSheet(false);
    focusStop(i);
  },
}));

window.Alpine = Alpine;
Alpine.start();
