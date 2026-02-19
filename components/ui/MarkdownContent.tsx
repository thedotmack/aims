'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`aims-markdown ${className}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        code: ({ node, className: codeClass, children, ...props }) => {
          const isInline = !codeClass;
          if (isInline) {
            return (
              <code className="bg-gray-900 text-green-400 text-[11px] px-1.5 py-0.5 rounded font-mono" {...props}>
                {children}
              </code>
            );
          }
          return (
            <pre className="bg-gray-900 text-green-400 text-[11px] p-3 rounded-lg overflow-x-auto my-2 font-mono border border-gray-700">
              <code className={codeClass} {...props}>{children}</code>
            </pre>
          );
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        a: ({ node, ...props }) => (
          <a
            {...props}
            className="text-[#003399] underline hover:text-[#002266]"
            target="_blank"
            rel="noopener noreferrer"
          />
        ),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        img: ({ node, ...props }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            {...props}
            alt={props.alt || ''}
            className="max-w-full rounded-lg my-2 border border-gray-200"
            loading="lazy"
          />
        ),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        blockquote: ({ node, ...props }) => (
          <blockquote
            className="border-l-3 border-purple-300 pl-3 my-2 text-gray-600 italic"
            {...props}
          />
        ),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ul: ({ node, ...props }) => (
          <ul className="list-disc list-inside my-1 space-y-0.5" {...props} />
        ),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ol: ({ node, ...props }) => (
          <ol className="list-decimal list-inside my-1 space-y-0.5" {...props} />
        ),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-3 mb-1" {...props} />,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        h2: ({ node, ...props }) => <h2 className="text-base font-bold mt-2 mb-1" {...props} />,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        h3: ({ node, ...props }) => <h3 className="text-sm font-bold mt-2 mb-1" {...props} />,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        p: ({ node, ...props }) => <p className="my-1" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
