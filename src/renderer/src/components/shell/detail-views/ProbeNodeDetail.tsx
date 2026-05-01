import type { ProbeNode } from '../../../../../core/types'
import { useFileContent } from '../../../hooks/useFileContent'
import { FileOpenMenu } from '../../common/FileOpenMenu'
import { DetailHeader } from '../../common/DetailHeader'
import { DetailSection } from '../../common/DetailSection'

interface Props {
  node: ProbeNode
}

export function ProbeNodeDetail({ node }: Props) {
  const { content, loading } = useFileContent(node.filePath ?? null)

  const stateBadge = (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
        node.state === 'certain'
          ? 'bg-emerald-500/10 text-emerald-500'
          : 'bg-amber-500/10 text-amber-500'
      }`}
    >
      {node.state}
    </span>
  )

  return (
    <div className="flex flex-col">
      <DetailHeader
        eyebrow={node.kind}
        title={node.label}
        subtitle={node.filePath}
        subtitleMono
        tokens={node.tokens}
        badges={stateBadge}
      />

      {node.trigger && (
        <DetailSection title="Trigger">
          <p className="text-xs text-content-secondary">{node.trigger}</p>
        </DetailSection>
      )}

      {node.note && (
        <DetailSection title="Note">
          <p className="text-xs text-content-secondary">{node.note}</p>
        </DetailSection>
      )}

      {node.filePath && (
        <DetailSection>
          <FileOpenMenu filePath={node.filePath} />
        </DetailSection>
      )}

      {node.filePath && (
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
      )}
    </div>
  )
}
