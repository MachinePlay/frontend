import { useQuery } from '@tanstack/react-query'
import { fetchEngineByName, type Engine, type EngineVersion } from './api'

// Versions of an engine (newest first), sharing the engine page's cache entry.
// Pass undefined to skip the fetch (e.g. an unselected engine).
export function useEngineVersions(engine: Engine | undefined): EngineVersion[] {
  const { data } = useQuery({
    queryKey: ['engine', engine?.owner_login ?? '', engine?.name ?? ''],
    queryFn: () => fetchEngineByName(engine!.owner_login, engine!.name),
    enabled: engine !== undefined,
    select: (d) => d.versions,
  })
  return data ?? []
}
