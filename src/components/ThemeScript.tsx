export function ThemeScript() {
  const script = `
    (function() {
      try {
        const raw = localStorage.getItem('meals.theme');
        const theme = raw ? JSON.parse(raw) : 'system';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.style.backgroundColor = isDark ? '#0f172a' : '#f0fdfa';
      } catch (error) {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.backgroundColor = '#f0fdfa';
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
