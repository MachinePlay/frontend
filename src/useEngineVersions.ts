import { useQuery } from '@tanstack/react-query'
import { fetchEngineByName, type Engine, type EngineVersion } from './api'

// Newest first, sharing the engine page's cache entry; undefined skips the fetch.
export function useEngineVersions(engine: Engine | undefined): EngineVersion[] {
  const { data } = useQuery({
    queryKey: ['engine', engine?.owner_login ?? '', engine?.name ?? ''],
    queryFn: () => fetchEngineByName(engine!.owner_login, engine!.name),
    enabled: engine !== undefined,
    select: (d) => d.versions,
  })
  return data ?? []
}
