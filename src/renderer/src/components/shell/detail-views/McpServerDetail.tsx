import type { ContextSource, McpDetails } from '../../../../../core/types'
import { FileOpenMenu } from '../../common/FileOpenMenu'
import { DetailHeader } from '../../common/DetailHeader'
import { DetailSection } from '../../common/DetailSection'

interface Props {
  source: ContextSource
}

const SCOPE_BLURB: Record<NonNullable<McpDetails['claudeScope']>, { title: string; subtitle: string }> = {
  project: {
    title: 'Project',
    subtitle: 'Defined in .mcp.json or project settings — shared with anyone who works in this repo.',
  },
  user: {
    title: 'User',
    subtitle: 'Loads in every project for this user.',
  },
  local: {
    title: 'Local',
    subtitle: 'User-private and bound to this project only.',
  },
}

/**
 * MCP entries don't get the generic file-preview treatment. Their backing
 * config (~/.claude.json, settings.json) usually mixes the server's tiny
 * config block with megabytes of unrelated runtime state, so dumping the
 * file would obscure rather than reveal. We show the structured fields and
 * offer an "open file" affordance for the full picture. See docs/vision.md.
 */
export function McpServerDetail({ source }: Props) {
  const mcp = source.mcp
  const scopeBlurb = mcp?.claudeScope ? SCOPE_BLURB[mcp.claudeScope] : null
  const hasConfig = Boolean(mcp?.transport || mcp?.command || mcp?.envKeys?.length)

  return (
    <div className="flex flex-col">
      <DetailHeader eyebrow="MCP Server" tokens={source.tokenEstimate} />

      {scopeBlurb && (
        <DetailSection title="Scope">
          <div className="text-xs text-content-primary">{scopeBlurb.title}</div>
          <p className="mt-0.5 text-xs text-content-muted">{scopeBlurb.subtitle}</p>
        </DetailSection>
      )}

      {hasConfig && (
        <DetailSection title="Configuration">
          {mcp?.transport && (
            <div className="text-xs text-content-secondary mb-1">
              <span className="text-content-muted">Transport: </span>
              <code className="font-mono">{mcp.transport}</code>
            </div>
          )}
          {mcp?.command && (
            <div className="text-xs text-content-secondary mb-1">
              <span className="text-content-muted">Command: </span>
              <code className="font-mono break-all">
                {mcp.command}
                {mcp.args?.length ? ` ${mcp.args.join(' ')}` : ''}
              </code>
            </div>
          )}
          {mcp?.envKeys && mcp.envKeys.length > 0 && (
            <div className="text-xs text-content-secondary">
              <span className="text-content-muted">Env vars: </span>
              <span className="font-mono">{mcp.envKeys.join(', ')}</span>
              <span className="text-content-muted"> (values not shown)</span>
            </div>
          )}
        </DetailSection>
      )}

      {!hasConfig && (
        <DetailSection>
          <p className="text-xs text-content-muted italic">
            Discovered via the <code className="font-mono">claude</code> CLI. Configuration details
            aren't available here — open the source file to inspect.
          </p>
        </DetailSection>
      )}

      {mcp?.sourceFile && (
        <DetailSection title="Defined in">
          <code className="text-xs bg-surface-raised px-2 py-1 rounded text-content-secondary font-mono break-all">
            {mcp.sourceFile}
          </code>
        </DetailSection>
      )}

      <DetailSection last>
        <FileOpenMenu filePath={source.filePath} />
      </DetailSection>
    </div>
  )
}
