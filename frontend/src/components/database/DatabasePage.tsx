import { useMemo, useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ArrowUpDown, ChevronLeft, ChevronRight, Database, MapPin, Search } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useInstancesDB } from '../../hooks/useInstancesDB'
import { isSupabaseConfigured } from '../../lib/supabase'
import { STATUTS } from '../../typesAthena'
import type { ObjectInstance } from '../../data/instancesApi'

const chartConfig = {
  total: { label: 'Objects', color: 'hsl(217 91% 60%)' },
} satisfies ChartConfig

/** Formate un horodatage ISO en heure locale HH:MM:SS. */
function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Construit la série « objets cumulés au cours du temps » : on trie les instances
 * par date de création, on regroupe par tranche d'une minute et on cumule.
 */
function serieCumul(instances: ObjectInstance[]): { label: string; total: number }[] {
  if (instances.length === 0) return []
  const parMinute = new Map<number, number>()
  for (const i of instances) {
    const t = new Date(i.cree_le).getTime()
    if (Number.isNaN(t)) continue
    const bucket = Math.floor(t / 60_000) * 60_000
    parMinute.set(bucket, (parMinute.get(bucket) ?? 0) + 1)
  }
  const buckets = [...parMinute.keys()].sort((a, b) => a - b)
  let cumul = 0
  return buckets.map((b) => {
    cumul += parMinute.get(b) ?? 0
    return {
      label: new Date(b).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      total: cumul,
    }
  })
}

const columns: ColumnDef<ObjectInstance>[] = [
  {
    accessorKey: 'libelle',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Object
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.libelle}</span>,
  },
  {
    accessorKey: 'type_name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Type
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className="font-normal">
        {row.original.type_name}
      </Badge>
    ),
  },
  {
    accessorKey: 'statut',
    header: 'Status',
    cell: ({ row }) => {
      const s = STATUTS[row.original.statut]
      return (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.couleur }} />
          {s.libelle}
        </span>
      )
    },
  },
  {
    id: 'position',
    header: 'Location',
    cell: ({ row }) => {
      const { lon, lat } = row.original
      if (lon == null || lat == null) return <span className="text-muted-foreground">—</span>
      return (
        <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {lat.toFixed(4)}, {lon.toFixed(4)}
        </span>
      )
    },
  },
  {
    accessorKey: 'appel_id',
    header: 'Call',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.appel_id ? row.original.appel_id.slice(0, 8) : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'cree_le',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Created
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{heure(row.original.cree_le)}</span>
    ),
  },
]

/**
 * Onglet Database : vue tabulaire (data table shadcn/tanstack) de toutes les
 * instances d'objets produites par les agents, plus un graphe du nombre d'objets
 * créés au cours du temps.
 */
export function DatabasePage() {
  const instances = useInstancesDB()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'cree_le', desc: true }])
  const [filtre, setFiltre] = useState('')

  const serie = useMemo(() => serieCumul(instances), [instances])
  const nbTypes = useMemo(() => new Set(instances.map((i) => i.type_name)).size, [instances])
  const nbGeoloc = useMemo(() => instances.filter((i) => i.lon != null && i.lat != null).length, [instances])

  const table = useReactTable({
    data: instances,
    columns,
    state: { sorting, globalFilter: filtre },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltre,
    globalFilterFn: (row, _columnId, value) => {
      const v = String(value).toLowerCase()
      return (
        row.original.libelle.toLowerCase().includes(v) ||
        row.original.type_name.toLowerCase().includes(v)
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 12 } },
  })

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <Database className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">
          Database
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {instances.length} object{instances.length === 1 ? '' : 's'}
          </span>
        </h1>
      </header>

      {!isSupabaseConfigured && (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Supabase is not configured: copy <code>frontend/.env.example</code> to{' '}
          <code>.env.local</code>, then restart <code>npm run dev</code>.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
          {/* Stats + graphe */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-3 gap-4 lg:col-span-1 lg:grid-cols-1">
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardDescription>Total objects</CardDescription>
                  <CardTitle className="text-2xl">{instances.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardDescription>Distinct types</CardDescription>
                  <CardTitle className="text-2xl">{nbTypes}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardDescription>Geolocated</CardDescription>
                  <CardTitle className="text-2xl">{nbGeoloc}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Objects added over time</CardTitle>
                <CardDescription>Cumulative count, bucketed by minute</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {serie.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                    No objects yet — start the simulation to see them appear.
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <AreaChart data={serie} margin={{ left: 4, right: 12, top: 8 }}>
                      <defs>
                        <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={32}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={28}
                        allowDecimals={false}
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Area
                        dataKey="total"
                        type="monotone"
                        stroke="var(--color-total)"
                        strokeWidth={2}
                        fill="url(#fillTotal)"
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Data table */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Objects</CardTitle>
                <CardDescription>All instances extracted by the agents</CardDescription>
              </div>
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filtre}
                  onChange={(e) => setFiltre(e.target.value)}
                  placeholder="Filter by object or type…"
                  className="h-9 pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((hg) => (
                      <TableRow key={hg.id} className="hover:bg-transparent">
                        {hg.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                          No objects.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
                <span>
                  {table.getFilteredRowModel().rows.length} object
                  {table.getFilteredRowModel().rows.length === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                  <span>
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
