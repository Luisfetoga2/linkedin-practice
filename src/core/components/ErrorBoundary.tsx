import { Component, type ReactNode } from 'react';
import { reloadForNewBuild } from '../../lib/chunks';

interface Props {
  /** Rendered instead of the children after an error; gets a reload action. */
  fallback: (reload: () => void) => ReactNode;
  children: ReactNode;
}

/** Keeps a failed game (or a chunk that didn't load) from blanking the whole page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
    // A missing chunk after a deploy: reload straight into the new build.
    if (/dynamically imported module|Importing a module script failed|error loading dynamically|preload/i.test(String(error))) reloadForNewBuild();
  }

  render() {
    return this.state.failed ? this.props.fallback(() => window.location.reload()) : this.props.children;
  }
}
