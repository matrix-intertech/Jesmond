'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong | Jesmond</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center font-sans">
        <h1 className="text-3xl font-extrabold text-primary mb-3">Something went wrong</h1>
        <p className="text-text-secondary mb-6 max-w-md text-base">
          An unexpected error occurred while loading this page. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center px-6 py-3 bg-accent text-white font-semibold rounded-xl min-h-[44px] min-w-[44px] shadow hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
