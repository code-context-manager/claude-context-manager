import { useState, useEffect } from 'react'

export function useFileContent(filePath: string | null) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!filePath) {
      setContent(null)
      return
    }

    setLoading(true)
    window.api.getFileContent(filePath).then((result) => {
      setContent(result)
      setLoading(false)
    })
  }, [filePath])

  return { content, loading }
}
