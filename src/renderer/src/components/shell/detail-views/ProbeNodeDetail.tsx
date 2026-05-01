import type { ProbeNode } from '../../../../../core/types'
import { useFileContent } from '../../../hooks/useFileContent'
import { FileOpenMenu } from '../../common/FileOpenMenu'
import { DetailHeader } from '../../common/DetailHeader'
import { DetailSection } from '../../common/DetailSection'
import { FilePreview } from '../../common/FilePreview'

interface Props {
  node: ProbeNode
}

export function ProbeNodeDetail({ node }: Props) {
  const { content, loading } = useFileContent(node.filePath ?? null)

  const stateBadge = (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
        node.state === 'certain'
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
      }`}
    >
      {node.state}
    </span>
  )

  return (
    <div className="flex flex-col">
      <DetailHeader eyebrow={node.kind} badges={stateBadge} />

      {node.filePath && (
        <DetailSection>
          <FileOpenMenu filePath={node.filePath} />
        </DetailSection>
      )}

      {node.filePath && (
        <DetailSection title="Preview" last>
          <FilePreview filePath={node.filePath} content={content} loading={loading} />
        </DetailSection>
      )}
    </div>
  )
}
