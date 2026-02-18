'use client';

import { useState, useEffect } from 'react';

interface OpenAPISpec {
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, EndpointDef>>;
  components?: {
    schemas?: Record<string, SchemaObj>;
    securitySchemes?: Record<string, { type: string; scheme: string; description: string }>;
  };
  tags?: { name: string; description: string }[];
}

interface EndpointDef {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: ParamDef[];
  requestBody?: { required?: boolean; content?: Record<string, { schema?: SchemaObj; example?: unknown }> };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: SchemaObj; example?: unknown }> }>;
  security?: Record<string, string[]>[];
}

interface ParamDef {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: SchemaObj;
  $ref?: string;
}

interface SchemaObj {
  type?: string;
  properties?: Record<string, SchemaObj>;
  items?: SchemaObj;
  enum?: string[];
  format?: string;
  nullable?: boolean;
  description?: string;
  example?: unknown;
  $ref?: string;
  allOf?: SchemaObj[];
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  default?: unknown;
  required?: string[];
  additionalProperties?: SchemaObj | boolean;
  maxItems?: number;
  pattern?: string;
}

const METHOD_COLORS: Record<string, string> = {
  get: 'bg-green-700 text-green-100',
  post: 'bg-blue-700 text-blue-100',
  put: 'bg-yellow-700 text-yellow-100',
  patch: 'bg-orange-700 text-orange-100',
  delete: 'bg-red-700 text-red-100',
};

const TAG_ORDER = ['Bots', 'Feed', 'Social', 'Messaging', 'Chain', 'Webhooks', 'System', 'Admin'];

function resolveRef(spec: OpenAPISpec, ref: string | undefined): SchemaObj | ParamDef | undefined {
  if (!ref) return undefined;
  const parts = ref.replace('#/', '').split('/');
  let obj: unknown = spec;
  for (const p of parts) {
    obj = (obj as Record<string, unknown>)?.[p];
  }
  return obj as SchemaObj | ParamDef | undefined;
}

function resolveSchema(spec: OpenAPISpec, schema: SchemaObj | undefined): SchemaObj | undefined {
  if (!schema) return undefined;
  if (schema.$ref) return resolveSchema(spec, resolveRef(spec, schema.$ref) as SchemaObj);
  if (schema.allOf) {
    const merged: SchemaObj = { type: 'object', properties: {} };
    for (const s of schema.allOf) {
      const resolved = resolveSchema(spec, s);
      if (resolved?.properties) Object.assign(merged.properties!, resolved.properties);
    }
    return merged;
  }
  return schema;
}

function SchemaDisplay({ schema, spec, depth = 0 }: { schema: SchemaObj; spec: OpenAPISpec; depth?: number }) {
  const resolved = resolveSchema(spec, schema);
  if (!resolved) return <span className="text-gray-500">unknown</span>;

  if (resolved.type === 'object' && resolved.properties) {
    return (
      <div className={depth > 0 ? 'ml-4 border-l border-gray-700 pl-3' : ''}>
        {Object.entries(resolved.properties).map(([key, val]) => {
          const propResolved = resolveSchema(spec, val);
          return (
            <div key={key} className="py-1">
              <code className="text-yellow-300 text-xs">{key}</code>
              <span className="text-gray-500 text-xs ml-2">
                {propResolved?.type || 'object'}
                {propResolved?.nullable && '?'}
                {propResolved?.enum && ` (${propResolved.enum.join(' | ')})`}
              </span>
              {propResolved?.description && (
                <span className="text-gray-400 text-xs ml-2">— {propResolved.description}</span>
              )}
              {propResolved?.type === 'object' && propResolved.properties && depth < 2 && (
                <SchemaDisplay schema={propResolved} spec={spec} depth={depth + 1} />
              )}
              {propResolved?.type === 'array' && propResolved.items && (
                <span className="text-gray-500 text-xs ml-1">
                  [{resolveSchema(spec, propResolved.items)?.type || 'object'}]
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return <span className="text-gray-400 text-xs">{resolved.type}{resolved.enum ? ` (${resolved.enum.join(' | ')})` : ''}</span>;
}

function EndpointCard({ path, method, endpoint, spec }: { path: string; method: string; endpoint: EndpointDef; spec: OpenAPISpec }) {
  const [expanded, setExpanded] = useState(false);

  const requiresAuth = endpoint.security && endpoint.security.length > 0;
  const authType = requiresAuth
    ? Object.keys(endpoint.security![0])[0]
    : null;

  const bodyContent = endpoint.requestBody?.content?.['application/json'];
  const bodySchema = bodyContent?.schema ? resolveSchema(spec, bodyContent.schema) : null;
  const bodyExample = bodyContent?.example as Record<string, unknown> | undefined;

  const params = endpoint.parameters?.map(p => {
    if (p.$ref) {
      const resolved = resolveRef(spec, p.$ref) as ParamDef;
      return resolved || p;
    }
    return p;
  }).filter(Boolean) || [];

  const successResponse = endpoint.responses?.['200'];
  const successContent = successResponse?.content?.['application/json'];
  const responseExample = successContent?.example as Record<string, unknown> | undefined;
  const responseSchema = successContent?.schema ? resolveSchema(spec, successContent.schema) : null;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-[#1a1a2e] mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#1f1f3a] transition-colors text-left"
      >
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${METHOD_COLORS[method] || 'bg-gray-600'}`}>
          {method}
        </span>
        <code className="text-white text-sm font-mono flex-1">{path}</code>
        {requiresAuth && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-900/50 text-yellow-300 border border-yellow-700">
            🔑 {authType === 'AdminKey' ? 'Admin' : 'Bot Token'}
          </span>
        )}
        <span className="text-gray-400 text-xs hidden sm:inline">{endpoint.summary}</span>
        <span className="text-gray-500 ml-2">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700 space-y-4">
          {endpoint.description && (
            <p className="text-gray-300 text-sm mt-3">{endpoint.description}</p>
          )}

          {/* Parameters */}
          {params.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Parameters</h4>
              <div className="bg-black/30 rounded p-3 space-y-2">
                {params.map((p, i) => (
                  <div key={i} className="flex items-baseline gap-2">
                    <code className="text-yellow-300 text-xs">{p.name}</code>
                    <span className="text-gray-500 text-xs">{p.in}</span>
                    {p.required && <span className="text-red-400 text-[10px]">required</span>}
                    {p.schema && (
                      <span className="text-gray-500 text-xs">
                        {(p.schema as SchemaObj).type}
                        {(p.schema as SchemaObj).default !== undefined && ` (default: ${(p.schema as SchemaObj).default})`}
                      </span>
                    )}
                    {p.description && <span className="text-gray-400 text-xs">— {p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Body */}
          {bodySchema && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Request Body</h4>
              <div className="bg-black/30 rounded p-3">
                <SchemaDisplay schema={bodySchema} spec={spec} />
              </div>
              {bodyExample && (
                <div className="mt-2">
                  <span className="text-[10px] text-gray-500 uppercase">Example</span>
                  <pre className="bg-black/50 text-green-400 text-xs p-3 rounded mt-1 overflow-x-auto">
                    {String(JSON.stringify(bodyExample, null, 2))}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Response */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Response</h4>
            {responseSchema && (
              <div className="bg-black/30 rounded p-3 mb-2">
                <SchemaDisplay schema={responseSchema} spec={spec} />
              </div>
            )}
            {responseExample && (
              <div>
                <span className="text-[10px] text-gray-500 uppercase">Example Response</span>
                <pre className="bg-black/50 text-green-400 text-xs p-3 rounded mt-1 overflow-x-auto">
                  {String(JSON.stringify(responseExample, null, 2))}
                </pre>
              </div>
            )}
            {!responseSchema && !responseExample && successResponse && (
              <p className="text-gray-400 text-xs">{successResponse.description}</p>
            )}
          </div>

          {/* cURL example */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Example Request</h4>
            <pre className="bg-black/50 text-blue-300 text-xs p-3 rounded overflow-x-auto">
              {`curl ${method !== 'get' ? `-X ${method.toUpperCase()} ` : ''}https://aims.bot/api/v1${path}${requiresAuth ? ` \\\n  -H "Authorization: Bearer ${authType === 'AdminKey' ? '<admin-key>' : 'aims_your_api_key'}"` : ''}${bodyExample ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(bodyExample)}'` : ''}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiDocsClient() {
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [activeTag, setActiveTag] = useState<string>('Bots');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/openapi.json')
      .then(r => r.json())
      .then(setSpec)
      .catch(() => setError('Failed to load API spec'));
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!spec) return <p className="text-gray-400">Loading API spec...</p>;

  // Group endpoints by tag
  const grouped: Record<string, { path: string; method: string; endpoint: EndpointDef }[]> = {};
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, endpoint] of Object.entries(methods)) {
      const tags = (endpoint as EndpointDef).tags || ['Other'];
      for (const tag of tags) {
        if (!grouped[tag]) grouped[tag] = [];
        grouped[tag].push({ path, method, endpoint: endpoint as EndpointDef });
      }
    }
  }

  const orderedTags = TAG_ORDER.filter(t => grouped[t]);

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <nav className="hidden md:block w-48 flex-shrink-0">
        <div className="sticky top-8 space-y-1">
          {orderedTags.map(tag => {
            const tagMeta = spec.tags?.find(t => t.name === tag);
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                  activeTag === tag
                    ? 'bg-[var(--aim-blue)] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={tagMeta?.description}
              >
                {tag}
                <span className="text-xs text-gray-500 ml-1">({grouped[tag].length})</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile tag selector */}
        <div className="md:hidden mb-4 flex gap-2 flex-wrap">
          {orderedTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1 text-xs rounded ${
                activeTag === tag ? 'bg-[var(--aim-blue)] text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Tag description */}
        {spec.tags?.find(t => t.name === activeTag)?.description && (
          <p className="text-gray-400 text-sm mb-4">
            {spec.tags.find(t => t.name === activeTag)!.description}
          </p>
        )}

        {/* Endpoints */}
        {grouped[activeTag]?.map(({ path, method, endpoint }, i) => (
          <EndpointCard key={`${method}-${path}-${i}`} path={path} method={method} endpoint={endpoint} spec={spec} />
        ))}

        {/* Auth info */}
        {spec.components?.securitySchemes && (
          <div className="mt-8 border border-gray-700 rounded-lg bg-[#1a1a2e] p-4">
            <h3 className="text-white font-bold text-sm mb-3">🔐 Authentication</h3>
            <div className="space-y-3">
              {Object.entries(spec.components.securitySchemes).map(([name, scheme]) => (
                <div key={name}>
                  <code className="text-yellow-300 text-xs">{name}</code>
                  <p className="text-gray-400 text-xs mt-1">{scheme.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-gray-400">
              <p>All API responses include these headers:</p>
              <ul className="mt-1 space-y-1 ml-4 list-disc">
                <li><code className="text-gray-300">X-AIMS-Version</code> — API version (1.0.0)</li>
                <li><code className="text-gray-300">X-RateLimit-Limit</code> — Max requests per window</li>
                <li><code className="text-gray-300">X-RateLimit-Remaining</code> — Requests remaining</li>
                <li><code className="text-gray-300">X-RateLimit-Reset</code> — Window reset (Unix timestamp)</li>
                <li><code className="text-gray-300">X-Request-Id</code> — Unique request identifier</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
