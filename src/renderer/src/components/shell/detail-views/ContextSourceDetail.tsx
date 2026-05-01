import type { ContextSource } from '../../../../../core/types'
import { ContextType } from '../../../../../core/types'
import { useFileContent } from '../../../hooks/useFileContent'
import { FileOpenMenu } from '../../common/FileOpenMenu'
import { DetailHeader } from '../../common/DetailHeader'
import { DetailSection } from '../../common/DetailSection'
import { McpServerDetail } from './McpServerDetail'

interface Props {
  source: ContextSource
}

const TYPE_LABELS: Record<ContextType, string> = {
  [ContextType.GlobalClaudeMd]: 'Global CLAUDE.md',
  [ContextType.ProjectClaudeMd]: 'Project CLAUDE.md',
  [ContextType.FolderClaudeMd]: 'Folder CLAUDE.md',
  [ContextType.Rule]: 'Rule',
  [ContextType.Skill]: 'Skill',
  [ContextType.Memory]: 'Memory',
  [ContextType.McpServer]: 'MCP Server',
  [ContextType.Settings]: 'Settings',
}

export function ContextSourceDetail({ source }: Props) {
  // MCP entries get a structured view — their backing config is usually a
  // multi-purpose blob (e.g. ~/.claude.json) where dumping the file content
  // would bury the actual server config in unrelated state. See vision.md.
  if (source.type === ContextType.McpServer) {
    return <McpServerDetail source={source} />
  }

  const { content, loading } = useFileContent(source.filePath)

  return (
    <div className="flex flex-col">
      <DetailHeader
        eyebrow={TYPE_LABELS[source.type]}
        title={source.name}
        subtitle={source.filePath}
        subtitleMono
        tokens={source.tokenEstimate}
      />

      {source.pathGlobs && source.pathGlobs.length > 0 && (
        <DetailSection title="Trigger paths">
          <div className="flex flex-col gap-1">
            {source.pathGlobs.map((glob) => (
              <code
                key={glob}
                className="text-xs bg-surface-raised px-2 py-1 rounded text-content-secondary font-mono"
              >
                {glob}
              </code>
            ))}
          </div>
        </DetailSection>
      )}

      {source.description && (
        <DetailSection title="Description">
          <p className="text-xs text-content-secondary">{source.description}</p>
        </DetailSection>
      )}

      {source.scopePath && (
        <DetailSection title="Scoped to">
          <code className="text-xs bg-surface-raised px-2 py-1 rounded text-content-secondary font-mono">
            {source.scopePath}
          </code>
        </DetailSection>
      )}

      <DetailSection>
        <FileOpenMenu filePath={source.filePath} />
      </DetailSection>

      <DetailSection title="Preview" last>
        {loading ? (
          <p className="text-xs text-content-muted">Loading…</p>
        ) : content ? (
          <pre className="text-xs text-content-secondary whitespace-pre-wrap font-mono leading-relaxed">
            {content.slice(0, 4000)}
            {content.length > 4000 && '\n\n…truncated…'}
          </pre>
        ) : (
          <p className="text-xs text-content-muted">Could not read file.</p>
        )}
      </DetailSection>
    </div>
  )
}
