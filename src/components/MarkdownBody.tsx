import ReactMarkdown from "react-markdown";

// Tailwind's preflight resets h1-h6 and ul/ol, and this project has no typography plugin, so every
// AI answer used to render as one flat paragraph run and its links navigated the SPA away.
// Markdown answers across the app share this one renderer instead of re-styling per surface.
export function MarkdownBody({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        a: (p: any) => (
          <a href={p.href} target="_blank" rel="noopener noreferrer"
            className="text-[#01411C] dark:text-emerald-300 font-semibold underline underline-offset-2 break-all">
            {p.children}
          </a>
        ),
        h1: (p: any) => <h3 className="mt-4 mb-1.5 text-base font-black text-[#01411C] first:mt-0" {...p} />,
        h2: (p: any) => <h4 className="mt-4 mb-1.5 text-sm font-extrabold text-gray-900 tracking-tight uppercase first:mt-0" {...p} />,
        h3: (p: any) => <h5 className="mt-3 mb-1 text-sm font-extrabold text-gray-900 first:mt-0" {...p} />,
        h4: (p: any) => <h6 className="mt-3 mb-1 text-[13px] font-bold text-gray-700 first:mt-0" {...p} />,
        p: (p: any) => <p className="my-2 first:mt-0 last:mb-0" {...p} />,
        ul: (p: any) => <ul className="my-2 space-y-1.5 list-disc pl-5 marker:text-[#01411C]" {...p} />,
        ol: (p: any) => <ol className="my-2 space-y-1.5 list-decimal pl-5 marker:font-bold marker:text-[#01411C]" {...p} />,
        li: (p: any) => <li className="pl-0.5 leading-relaxed" {...p} />,
        strong: (p: any) => <strong className="font-extrabold text-gray-900" {...p} />,
        hr: () => <hr className="my-4 border-gray-200" />
      }}
    >{text}</ReactMarkdown>
  );
}
