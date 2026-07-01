import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { fetchRunner, profileUrl, updateRunner, type Runner } from '../api'
import { Hint, PrimaryButton, Section, StatusDot } from '../components'
import { useAuth } from '../auth-context'
import { relativeTime } from '../format'
import NotFound from './NotFound'

const fieldClass =
  'bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm'

// Owner-only editor for a runner's name + description. Keyed on the runner id by
// the caller so switching runners reseeds the fields.
function RunnerEditor({ runner }: { runner: Runner }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(runner.name)
  const [description, setDescription] = useState(runner.description)

  const save = useMutation({
    mutationFn: () =>
      updateRunner(runner.runner_id, { name, description }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['runner', runner.runner_id] })
      await queryClient.invalidateQueries({ queryKey: ['runners'] })
    },
  })

  const dirty = name !== runner.name || description !== runner.description

  return (
    <Section title="edit">
      <div className="flex flex-col gap-2 max-w-xl">
        <label className="flex items-center gap-2">
          <span className="text-neutral-400 w-20 text-sm">name</span>
          <input
            className={`${fieldClass} flex-1 min-w-0`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex items-start gap-2">
          <span className="text-neutral-400 w-20 text-sm pt-1">description</span>
          <textarea
            className={`${fieldClass} flex-1 min-w-0 resize-y`}
            rows={3}
            value={description}
            placeholder="describe this runner"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-3 sm:pl-[5.5rem]">
          <PrimaryButton
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? 'saving…' : 'save'}
          </PrimaryButton>
          {save.isError && (
            <span className="text-red-400 text-xs">
              {save.error instanceof Error ? save.error.message : 'save failed'}
            </span>
          )}
        </div>
      </div>
    </Section>
  )
}

// Mounted at /runners/:id.
export default function RunnerDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { data: runner, error } = useQuery({
    queryKey: ['runner', id],
    queryFn: () => fetchRunner(id),
    staleTime: 5_000,
  })

  if (error) {
    return <NotFound />
  }
  if (!runner) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Hint>loading…</Hint>
      </div>
    )
  }

  const isOwner = user?.login === runner.owner_login

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-100">
          <StatusDot online={runner.online} />
          {runner.name}
        </h1>
        <p className="text-sm text-neutral-400">
          owned by{' '}
          <Link
            to={profileUrl(runner.owner_login)}
            className="text-neutral-300 hover:text-neutral-100 transition-colors"
          >
            {runner.owner_login}
          </Link>
        </p>
        {runner.description && (
          <p className="text-neutral-400 text-sm mt-1">{runner.description}</p>
        )}
      </div>

      <Section title="status">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-neutral-500">state</dt>
          <dd className="text-neutral-200">
            {runner.online ? 'online' : 'offline'}
          </dd>
          <dt className="text-neutral-500">capacity</dt>
          <dd className="text-neutral-200">
            {runner.active_games}/{runner.max_games} games
          </dd>
          <dt className="text-neutral-500">last seen</dt>
          <dd className="text-neutral-200">
            {runner.last_seen_at ? relativeTime(runner.last_seen_at) : '—'}
          </dd>
        </dl>
      </Section>

      {isOwner && <RunnerEditor key={runner.runner_id} runner={runner} />}
    </div>
  )
}
