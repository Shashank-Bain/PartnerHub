import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const apiHeaders = { 'Content-Type': 'application/json' }

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}

const SCALE_LABELS = ['X', 'A', 'P', 'L', 'D']

function hashString(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function buildDummyKpiInsights(sectorName, selectedCompany) {
  const key = `${sectorName || ''}-${selectedCompany || ''}-kpi`

  return {
    metrics: [
      { label: 'Decarbonization Velocity', value: `${4 + (hashString(`${key}-carbon`) % 7)}% YoY`, trend: 'Improving' },
      { label: 'Sustainability Capex Yield', value: `${11 + (hashString(`${key}-capex`) % 12)}%`, trend: 'Stable' },
      { label: 'Narrative Credibility Index', value: `${63 + (hashString(`${key}-narrative`) % 28)}/100`, trend: 'At risk' },
    ],
    moves: [
      'Prioritize 2–3 high-visibility KPI commitments with CFO-backed accountability.',
      'Strengthen external narrative with quantified progress and near-term milestones.',
      'Align KPI governance cadence with board and investor communication windows.',
    ],
  }
}

function formatPct(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '0.0%'
  }
  return `${numericValue.toFixed(1)}%`
}

function StatusScaleCell({ overallStatus, peerAverage, bestScore }) {
  const toScaleScore = (value) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return 0
    return Math.max(0, Math.min(100, numericValue))
  }

  const companyScore = toScaleScore(overallStatus?.finalScore)
  const peerScore = toScaleScore(peerAverage)
  const best = toScaleScore(bestScore)

  const markers = [
    { type: 'company', longLabel: 'Client', rawScore: companyScore, score: companyScore },
    { type: 'peer', longLabel: 'Peer Avg', rawScore: peerScore, score: peerScore },
    { type: 'best', longLabel: 'Best', rawScore: best, score: best },
  ]

  const sortedMarkers = [...markers].sort((first, second) => first.score - second.score)
  const minGap = 1.4
  for (let index = 1; index < sortedMarkers.length; index += 1) {
    const current = sortedMarkers[index]
    const previous = sortedMarkers[index - 1]
    if (current.score - previous.score < minGap) {
      current.score = Math.min(100, previous.score + minGap)
    }
  }

  for (let index = sortedMarkers.length - 2; index >= 0; index -= 1) {
    const current = sortedMarkers[index]
    const next = sortedMarkers[index + 1]
    if (next.score - current.score < minGap) {
      current.score = Math.max(0, next.score - minGap)
    }
  }

  const markerByType = Object.fromEntries(sortedMarkers.map((marker) => [marker.type, marker]))
  const companyMarker = markerByType.company
  const peerMarker = markerByType.peer
  const bestMarker = markerByType.best

  return (
    <div className="status-scale-wrap">
      <div className="status-client-score">
        <span className="status-client-score-label">Company Score</span>
        <span className="status-client-score-value">{companyScore.toFixed(1)}</span>
      </div>
      <div className="status-scale-track">
        <div className="status-scale-gradient" />
        <span
          className="status-marker-line company"
          style={{ left: `${companyMarker.score}%` }}
          title={`${companyMarker.longLabel} ${companyMarker.rawScore.toFixed(1)}`}
        />

        <span
          className="status-marker-triangle peer"
          style={{ left: `${peerMarker.score}%` }}
          title={`${peerMarker.longLabel} ${peerMarker.rawScore.toFixed(1)}`}
        />
        <span className="status-marker-label peer" style={{ left: `${peerMarker.score}%` }}>
          P {peerMarker.rawScore.toFixed(1)}
        </span>

        <span
          className="status-marker-triangle best"
          style={{ left: `${bestMarker.score}%` }}
          title={`${bestMarker.longLabel} ${bestMarker.rawScore.toFixed(1)}`}
        />
        <span className="status-marker-label best" style={{ left: `${bestMarker.score}%` }}>
          B {bestMarker.rawScore.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

function CommitmentProgressTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const row = payload[0]?.payload
  if (!row) {
    return null
  }

  return (
    <div className="commitment-tooltip">
      <strong>{label}</strong>
      <p>Total commitments: {row.totalCommitments}</p>
      <p>Achieved: {row.achievedCount} ({row.achievedPct.toFixed(1)}%)</p>
      <p>On-Track: {row.onTrackCount} ({row.onTrackPct.toFixed(1)}%)</p>
      <p>Off-Track: {row.offTrackCount} ({row.offTrackPct.toFixed(1)}%)</p>
      <p>Not Reporting: {row.noReportingCount} ({row.noReportingPct.toFixed(1)}%)</p>
      <p>No-target: {row.noTargetCount} ({row.noTargetPct.toFixed(1)}%)</p>
    </div>
  )
}

function CommitmentProgressChart({ ranking }) {
  const chartData = (ranking || []).map((item) => {
    const totalCommitments = Number(item.totalCommitments || 0)
    const achievedCount = Number(item.breakdown?.achieved || 0)
    const onTrackCount = Number(item.breakdown?.onTrack || 0)
    const offTrackCount = Number(item.breakdown?.offTrack || 0)
    const noReportingCount = Number(item.breakdown?.noReporting || 0)
    const noTargetCount = Number(item.breakdown?.noTarget || item.breakdown?.others || 0)

    const toPct = (value) => (totalCommitments > 0 ? (value / totalCommitments) * 100 : 0)

    return {
      company: item.isSelected ? `${item.company} (Client)` : item.company,
      totalCommitments,
      achievedCount,
      onTrackCount,
      offTrackCount,
      noReportingCount,
      noTargetCount,
      achievedPct: toPct(achievedCount),
      onTrackPct: toPct(onTrackCount),
      offTrackPct: toPct(offTrackCount),
      noReportingPct: toPct(noReportingCount),
      noTargetPct: toPct(noTargetCount),
    }
  })

  if (!chartData.length) {
    return null
  }

  const chartHeight = Math.max(420, chartData.length * 56)

  return (
    <div className="commitment-progress-chart-wrap">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 22, left: 10, bottom: 54 }}
          barCategoryGap={18}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 104, 144, 0.2)" />
          <XAxis
            dataKey="company"
            type="category"
            interval={0}
            angle={0}
            textAnchor="middle"
            tickMargin={10}
            tick={{ fontSize: 12, fill: '#515a7a' }}
            stroke="rgba(95, 104, 144, 0.35)"
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12, fill: '#2f3554' }}
            stroke="rgba(95, 104, 144, 0.35)"
          />
          <Tooltip content={<CommitmentProgressTooltip />} cursor={{ fill: 'rgba(104, 70, 218, 0.08)' }} />
          <Bar dataKey="achievedPct" stackId="commitment" name="Achieved" fill="#1a8f4e" radius={[0, 0, 0, 0]} />
          <Bar dataKey="onTrackPct" stackId="commitment" name="On-Track" fill="#63b36b" radius={[0, 0, 0, 0]} />
          <Bar dataKey="offTrackPct" stackId="commitment" name="Off-Track" fill="#d65b5b" radius={[0, 0, 0, 0]} />
          <Bar dataKey="noReportingPct" stackId="commitment" name="Not Reporting" fill="#9ba2b7" radius={[0, 0, 0, 0]} />
          <Bar dataKey="noTargetPct" stackId="commitment" name="No-target" fill="#c9ceda" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ThemeSpiderChart({ data, companyName }) {
  if (!data || data.length === 0) {
    return <div className="radar-empty">No theme data</div>
  }

  const toScore = (value) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return 0
    return Math.max(0, Math.min(100, numericValue))
  }

  const axisLabel = (theme) => {
    const text = String(theme || '').trim()
    if (text.length <= 18) return text
    return `${text.slice(0, 18)}…`
  }

  const chartData = data.map((item) => ({
    theme: item.theme,
    axisLabel: axisLabel(item.theme),
    companyScore: toScore(item.companyScore),
    peerAvg: toScore(item.peerAvg),
  }))

  return (
    <div className="radar-wrap">
      <div className="spider-chart-wrap" role="img" aria-label="Theme comparison spider chart">
        <ResponsiveContainer width="100%" height={380}>
          <RechartsRadarChart data={chartData} outerRadius="68%">
            <PolarGrid stroke="rgba(104, 70, 218, 0.24)" radialLines />
            <PolarAngleAxis dataKey="axisLabel" tick={{ fontSize: 11, fill: '#3f4568' }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tickCount={6}
              tick={{ fontSize: 10, fill: '#65708f' }}
              axisLine={false}
            />
            <Tooltip
              formatter={(value, name) => [`${Number(value).toFixed(1)}`, name]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.theme || ''}
            />
            <Legend />
            <Radar
              name={companyName || 'Company'}
              dataKey="companyScore"
              stroke="rgba(104, 70, 218, 0.9)"
              fill="rgba(104, 70, 218, 0.26)"
              fillOpacity={0.8}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: 'rgba(104, 70, 218, 1)' }}
            />
            <Radar
              name="Peer average"
              dataKey="peerAvg"
              stroke="rgba(185, 11, 22, 0.85)"
              fill="rgba(185, 11, 22, 0.14)"
              fillOpacity={0.7}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: 'rgba(185, 11, 22, 0.82)' }}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const STACKED_COLORS = ['#6846da', '#813aa3', '#a02c64', '#b90b16', '#6f7797']

function InvestmentStackedChart({ title, breakdown }) {
  const rows = breakdown?.rows || []
  const keys = breakdown?.keys || []

  if (!rows.length || !keys.length) {
    return (
      <section className="card scorecard-chart-card">
        <h3 className="scorecard-chart-title">{title}</h3>
        <div className="scorecard-thin-divider" />
        <p>No chart data available.</p>
      </section>
    )
  }

  return (
    <section className="card scorecard-chart-card">
      <h3 className="scorecard-chart-title">{title}</h3>
      <div className="scorecard-thin-divider" />
      <div className="investment-chart-wrap">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={rows} margin={{ top: 8, right: 14, left: 4, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 104, 144, 0.2)" />
            <XAxis
              dataKey="company"
              type="category"
              interval={0}
              tick={{ fontSize: 12, fill: '#515a7a' }}
              stroke="rgba(95, 104, 144, 0.35)"
            />
            <YAxis
              type="number"
              tick={{ fontSize: 12, fill: '#2f3554' }}
              stroke="rgba(95, 104, 144, 0.35)"
              allowDecimals={false}
            />
            <Tooltip />
            <Legend />
            {keys.map((key, index) => (
              <Bar key={key} dataKey={key} stackId="investment" fill={STACKED_COLORS[index % STACKED_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function SustainabilityDealsTrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const row = payload[0]?.payload
  if (!row) {
    return null
  }

  return (
    <div className="commitment-tooltip">
      <strong>{label}</strong>
      <p>Sustainability deal share: {formatPct(row.sustainabilityPct)}</p>
      <p>Peer average: {formatPct(row.peerAvgPct)}</p>
    </div>
  )
}

function SustainabilityDealsTrendChart({ data }) {
  if (!data?.length) {
    return null
  }

  return (
    <div className="investment-trend-chart-wrap">
      <ResponsiveContainer width="100%" height={210}>
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 2, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 104, 144, 0.2)" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: '#515a7a' }}
            stroke="rgba(95, 104, 144, 0.35)"
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12, fill: '#2f3554' }}
            stroke="rgba(95, 104, 144, 0.35)"
          />
          <Tooltip content={<SustainabilityDealsTrendTooltip />} cursor={{ fill: 'rgba(104, 70, 218, 0.08)' }} />
          <Bar dataKey="sustainabilityPct" name="Sustainability deals" fill="rgba(104, 70, 218, 0.72)" radius={[6, 6, 0, 0]} />
          <Line
            type="monotone"
            dataKey="peerAvgPct"
            name="Peer average"
            stroke="rgba(185, 11, 22, 0.85)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'rgba(185, 11, 22, 0.85)' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [firstLoginCurrentPassword, setFirstLoginCurrentPassword] = useState('')
  const [firstLoginNewPassword, setFirstLoginNewPassword] = useState('')
  const [firstLoginConfirmPassword, setFirstLoginConfirmPassword] = useState('')

  const [sectors, setSectors] = useState([])
  const [sectorCompanyMap, setSectorCompanyMap] = useState({})
  const [selectedSector, setSelectedSector] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [materialTopicComparison, setMaterialTopicComparison] = useState(null)
  const [isMaterialTopicLoading, setIsMaterialTopicLoading] = useState(false)
  const [recommendations, setRecommendations] = useState(null)
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false)
  const [commitmentOverview, setCommitmentOverview] = useState(null)
  const [isCommitmentOverviewLoading, setIsCommitmentOverviewLoading] = useState(false)
  const [scorecardData, setScorecardData] = useState(null)
  const [isScorecardLoading, setIsScorecardLoading] = useState(false)
  const [investmentInsights, setInvestmentInsights] = useState(null)
  const [isInvestmentInsightsLoading, setIsInvestmentInsightsLoading] = useState(false)
  const [activeModal, setActiveModal] = useState(null)

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [activeView, setActiveView] = useState('home')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState('')
  const [settingsNewPassword, setSettingsNewPassword] = useState('')
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)

  const [users, setUsers] = useState([])
  const [allSectors, setAllSectors] = useState([])
  const [editingUserId, setEditingUserId] = useState(null)
  const [adminFormEmail, setAdminFormEmail] = useState('')
  const [adminFormPassword, setAdminFormPassword] = useState('')
  const [adminFormFirstName, setAdminFormFirstName] = useState('')
  const [adminFormLastName, setAdminFormLastName] = useState('')
  const [adminFormSectors, setAdminFormSectors] = useState([])
  const [adminFormIsAdmin, setAdminFormIsAdmin] = useState(false)
  const [isLogoAvailable, setIsLogoAvailable] = useState(true)

  const userMenuRef = useRef(null)
  const greeting = useMemo(() => getGreeting(), [])
  const companies = selectedSector ? sectorCompanyMap[selectedSector] || [] : []
  const kpiInsights = useMemo(
    () => buildDummyKpiInsights(selectedSector, selectedCompany),
    [selectedSector, selectedCompany],
  )
  const kpiTrendSummary = useMemo(() => {
    const metrics = kpiInsights?.metrics || []
    const improvingCount = metrics.filter((metric) => metric.trend?.toLowerCase() === 'improving').length
    const stableCount = metrics.filter((metric) => metric.trend?.toLowerCase() === 'stable').length
    const riskCount = metrics.filter((metric) => metric.trend?.toLowerCase() === 'at risk').length

    return {
      total: metrics.length,
      improvingCount,
      stableCount,
      riskCount,
    }
  }, [kpiInsights])
  const investmentTrendData = useMemo(() => {
    const baseYear = new Date().getFullYear()
    const years = [baseYear - 2, baseYear - 1, baseYear]
    const seed = hashString(`${selectedSector || ''}-${selectedCompany || ''}-investment-trend`)

    return years.map((year, index) => {
      const drift = ((seed + index * 13) % 21) - 10
      const sustainabilityPct = Math.max(20, Math.min(88, 50 + drift + index * 4))
      const peerAvgPct = Math.max(18, Math.min(90, sustainabilityPct + ((seed + index * 7) % 9) - 4))

      return {
        year: String(year),
        sustainabilityPct,
        peerAvgPct,
      }
    })
  }, [selectedSector, selectedCompany])
  const investmentFocusMatrix = useMemo(() => {
    const fallbackTopics = ['Energy Efficiency', 'Circularity', 'Low-Carbon Supply Chain']

    const selectedDealFocus = (investmentInsights?.topClassifications || [])
      .map((item) => item?.label)
      .filter(Boolean)
      .slice(0, 3)

    const selectedCapexFocus = (investmentInsights?.greenCapexCategories || [])
      .map((item) => item?.label)
      .filter(Boolean)
      .slice(0, 3)

    const peerTopicTotals = {}
    for (const row of investmentInsights?.charts?.topics?.rows || []) {
      if (row?.isSelected) {
        continue
      }

      for (const [key, value] of Object.entries(row || {})) {
        if (['company', 'isSelected', 'Other'].includes(key)) {
          continue
        }
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
          continue
        }
        peerTopicTotals[key] = (peerTopicTotals[key] || 0) + numericValue
      }
    }

    const peerFocusTopics = Object.entries(peerTopicTotals)
      .sort((first, second) => second[1] - first[1])
      .map(([topic]) => topic)
      .slice(0, 3)

    return {
      selectedDealFocus: selectedDealFocus.length ? selectedDealFocus : (investmentInsights?.topSustainabilityTopics || []).slice(0, 3).concat(fallbackTopics).slice(0, 3),
      selectedCapexFocus: selectedCapexFocus.length ? selectedCapexFocus : (investmentInsights?.topTopics2025_26 || []).map((item) => item?.label).filter(Boolean).slice(0, 3).concat(fallbackTopics).slice(0, 3),
      peerDealFocus: peerFocusTopics.length ? peerFocusTopics : fallbackTopics,
      peerCapexFocus: peerFocusTopics.length ? [...peerFocusTopics].reverse().slice(0, 3) : fallbackTopics,
    }
  }, [investmentInsights])

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const authRes = await fetch('/api/auth/me', { credentials: 'include' })
        if (authRes.ok) {
          const authData = await authRes.json()
          setUser(authData.user)
          setFirstName(authData.user.firstName)
          setLastName(authData.user.lastName)
          await loadOptions(authData.user)
          if (authData.user.isAdmin) {
            await loadAdminData()
          }
        }
      } catch {
        setError('Unable to connect to backend. Please start Flask server.')
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setActiveModal(null)
      }
    }

    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!companies.includes(selectedCompany)) {
      setSelectedCompany(companies[0] || '')
    }
  }, [companies, selectedCompany])

  useEffect(() => {
    if (!user || !selectedSector || !selectedCompany) {
      setMaterialTopicComparison(null)
      setIsMaterialTopicLoading(false)
      setRecommendations(null)
      setIsRecommendationsLoading(false)
      setCommitmentOverview(null)
      setIsCommitmentOverviewLoading(false)
      setScorecardData(null)
      setIsScorecardLoading(false)
      setInvestmentInsights(null)
      setIsInvestmentInsightsLoading(false)
      return
    }

    loadMaterialTopicComparison(selectedSector, selectedCompany)
    loadRecommendations(selectedSector, selectedCompany)
    loadCommitmentOverview(selectedSector, selectedCompany)
    loadScorecard(selectedSector, selectedCompany)
    loadInvestmentInsights(selectedSector, selectedCompany)
  }, [user, selectedSector, selectedCompany])

  const clearAlerts = () => {
    setError('')
    setMessage('')
  }

  const resetAdminForm = () => {
    setEditingUserId(null)
    setAdminFormEmail('')
    setAdminFormPassword('')
    setAdminFormFirstName('')
    setAdminFormLastName('')
    setAdminFormSectors([])
    setAdminFormIsAdmin(false)
  }

  const loadOptions = async () => {
    const optionsRes = await fetch('/api/options', { credentials: 'include' })
    if (!optionsRes.ok) {
      setSectors([])
      setSectorCompanyMap({})
      setSelectedSector('')
      setSelectedCompany('')
      return
    }

    const optionsData = await optionsRes.json()
    const nextSectors = optionsData.sectors || []
    const nextMap = optionsData.sectorCompanyMap || {}
    const nextSector = nextSectors[0] || ''
    const nextCompanies = nextSector ? nextMap[nextSector] || [] : []

    setSectors(nextSectors)
    setSectorCompanyMap(nextMap)
    setSelectedSector(nextSector)
    setSelectedCompany(nextCompanies[0] || '')
  }

  const loadAdminData = async () => {
    const [metadataRes, usersRes] = await Promise.all([
      fetch('/api/admin/metadata', { credentials: 'include' }),
      fetch('/api/admin/users', { credentials: 'include' }),
    ])

    if (metadataRes.ok) {
      const metadataData = await metadataRes.json()
      setAllSectors(metadataData.sectors || [])
    }

    if (usersRes.ok) {
      const usersData = await usersRes.json()
      setUsers(usersData.users || [])
    }
  }

  const loadMaterialTopicComparison = async (sectorName, companyName) => {
    setIsMaterialTopicLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/material-topics/comparison?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setMaterialTopicComparison(null)
        return
      }

      const data = await res.json()
      setMaterialTopicComparison(data)
    } catch {
      setMaterialTopicComparison(null)
    } finally {
      setIsMaterialTopicLoading(false)
    }
  }

  const loadRecommendations = async (sectorName, companyName) => {
    setIsRecommendationsLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/recommendations?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setRecommendations(null)
        return
      }

      const data = await res.json()
      setRecommendations(data)
    } catch {
      setRecommendations(null)
    } finally {
      setIsRecommendationsLoading(false)
    }
  }

  const loadCommitmentOverview = async (sectorName, companyName) => {
    setIsCommitmentOverviewLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/commitments/overview?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setCommitmentOverview(null)
        return
      }

      const data = await res.json()
      setCommitmentOverview(data)
    } catch {
      setCommitmentOverview(null)
    } finally {
      setIsCommitmentOverviewLoading(false)
    }
  }

  const loadScorecard = async (sectorName, companyName) => {
    setIsScorecardLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/scorecard?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setScorecardData(null)
        return
      }

      const data = await res.json()
      setScorecardData(data)
    } catch {
      setScorecardData(null)
    } finally {
      setIsScorecardLoading(false)
    }
  }

  const loadInvestmentInsights = async (sectorName, companyName) => {
    setIsInvestmentInsightsLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/investments/insights?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setInvestmentInsights(null)
        return
      }

      const data = await res.json()
      setInvestmentInsights(data)
    } catch {
      setInvestmentInsights(null)
    } finally {
      setIsInvestmentInsightsLoading(false)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    clearAlerts()

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Login failed.')
        return
      }

      setUser(data.user)
      setFirstName(data.user.firstName)
      setLastName(data.user.lastName)
      setEmail('')
      setPassword('')
      setMessage('Login successful.')

      await loadOptions()
      if (data.user.isAdmin) {
        await loadAdminData()
      }
    } catch {
      setError('Unable to login right now.')
    }
  }

  const handleLogout = async () => {
    clearAlerts()
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setIsUserMenuOpen(false)
    setShowChangePassword(false)
    setActiveModal(null)
    setActiveView('home')
    setCommitmentOverview(null)
    setScorecardData(null)
    setInvestmentInsights(null)
    setUsers([])
    setAllSectors([])
    resetAdminForm()
    setMessage('Logged out successfully.')
  }

  const handleFirstLoginPasswordChange = async (event) => {
    event.preventDefault()
    clearAlerts()

    if (firstLoginNewPassword !== firstLoginConfirmPassword) {
      setError('New password and confirm password must match.')
      return
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({
          currentPassword: firstLoginCurrentPassword,
          newPassword: firstLoginNewPassword,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Unable to change password.')
        return
      }

      setUser(data.user)
      setFirstName(data.user.firstName)
      setLastName(data.user.lastName)
      setFirstLoginCurrentPassword('')
      setFirstLoginNewPassword('')
      setFirstLoginConfirmPassword('')
      setMessage('Password changed successfully. Welcome!')

      await loadOptions()
      if (data.user.isAdmin) {
        await loadAdminData()
      }
    } catch {
      setError('Unable to change password right now.')
    }
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    clearAlerts()

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({ firstName, lastName }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Unable to save profile.')
        return
      }

      setUser(data.user)
      setMessage('Profile updated successfully.')
    } catch {
      setError('Unable to save profile right now.')
    }
  }

  const handleSettingsPasswordChange = async (event) => {
    event.preventDefault()
    clearAlerts()

    if (settingsNewPassword !== settingsConfirmPassword) {
      setError('New password and confirm password must match.')
      return
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({
          currentPassword: settingsCurrentPassword,
          newPassword: settingsNewPassword,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Unable to change password.')
        return
      }

      setUser(data.user)
      setSettingsCurrentPassword('')
      setSettingsNewPassword('')
      setSettingsConfirmPassword('')
      setShowChangePassword(false)
      setMessage('Password changed successfully.')
    } catch {
      setError('Unable to change password right now.')
    }
  }

  const toggleAdminSector = (sectorName) => {
    setAdminFormSectors((current) => {
      if (current.includes(sectorName)) {
        return current.filter((sector) => sector !== sectorName)
      }
      return [...current, sectorName]
    })
  }

  const handleEditUser = (targetUser) => {
    setEditingUserId(targetUser.id)
    setAdminFormEmail(targetUser.email)
    setAdminFormPassword('')
    setAdminFormFirstName(targetUser.firstName)
    setAdminFormLastName(targetUser.lastName)
    setAdminFormSectors(targetUser.sectors || [])
    setAdminFormIsAdmin(!!targetUser.isAdmin)
  }

  const handleAdminUserSubmit = async (event) => {
    event.preventDefault()
    clearAlerts()

    if (!adminFormEmail || !adminFormFirstName || !adminFormLastName) {
      setError('Email, first name and last name are required.')
      return
    }

    if (!editingUserId && !adminFormPassword) {
      setError('Password is required while adding a user.')
      return
    }

    const payload = {
      firstName: adminFormFirstName,
      lastName: adminFormLastName,
      sectors: adminFormSectors,
      isAdmin: adminFormIsAdmin,
    }

    if (editingUserId) {
      if (adminFormPassword.trim()) {
        payload.password = adminFormPassword.trim()
      }
    } else {
      payload.email = adminFormEmail.trim().toLowerCase()
      payload.password = adminFormPassword
    }

    const endpoint = editingUserId ? `/api/admin/users/${editingUserId}` : '/api/admin/users'
    const method = editingUserId ? 'PUT' : 'POST'

    try {
      const res = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Unable to save user.')
        return
      }

      await loadAdminData()
      await loadOptions()
      const successMessage = editingUserId ? 'User updated successfully.' : 'User created successfully.'
      const warningSuffix = data.storageWarning ? ` ${data.storageWarning}` : ''
      setMessage(`${successMessage}${warningSuffix}`)
      resetAdminForm()
    } catch {
      setError('Unable to save user right now.')
    }
  }

  const handleDeleteUser = async (targetUser) => {
    clearAlerts()

    const confirmed = window.confirm(`Delete user ${targetUser.email}?`)
    if (!confirmed) {
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Unable to delete user.')
        return
      }

      await loadAdminData()
      await loadOptions()
      const warningSuffix = data.storageWarning ? ` ${data.storageWarning}` : ''
      setMessage(`User deleted successfully.${warningSuffix}`)
      if (editingUserId === targetUser.id) {
        resetAdminForm()
      }
    } catch {
      setError('Unable to delete user right now.')
    }
  }

  if (isLoading) {
    return (
      <div className="screen-center">
        <div className="card">Loading Pulse Partner Hub...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="screen-center app-bg">
        <form className="card auth-card" onSubmit={handleLogin}>
          <h1>Pulse Partner Hub</h1>
          <div className="gradient-line" />
          <p className="subtitle">Please login with your email and password.</p>

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
          />

          <button type="submit" className="btn-primary">Login</button>
        </form>
      </div>
    )
  }

  if (user.mustChangePassword) {
    return (
      <div className="screen-center app-bg">
        <form className="card auth-card" onSubmit={handleFirstLoginPasswordChange}>
          <h1>Change Password</h1>
          <div className="gradient-line" />
          <p className="subtitle">This is your first login. Please set a new password to continue.</p>

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          <label>Current Password</label>
          <input
            type="password"
            value={firstLoginCurrentPassword}
            onChange={(event) => setFirstLoginCurrentPassword(event.target.value)}
            required
          />

          <label>New Password</label>
          <input
            type="password"
            value={firstLoginNewPassword}
            onChange={(event) => setFirstLoginNewPassword(event.target.value)}
            required
          />

          <label>Confirm New Password</label>
          <input
            type="password"
            value={firstLoginConfirmPassword}
            onChange={(event) => setFirstLoginConfirmPassword(event.target.value)}
            required
          />

          <button type="submit" className="btn-primary">Save New Password</button>
        </form>
      </div>
    )
  }

  return (
    <div className="app-bg dashboard-wrap">
      <nav className="navbar">
        <div className="logo-wrap">
          <button
            type="button"
            className="logo-placeholder"
            onClick={() => {
              setActiveView('home')
              setIsUserMenuOpen(false)
            }}
          >
            {isLogoAvailable ? (
              <img
                src="/Logo.png"
                alt="Pulse Partner Hub Logo"
                className="logo-image"
                onError={() => setIsLogoAvailable(false)}
              />
            ) : (
              <span>Logo</span>
            )}
          </button>
        </div>

        <div className="nav-greeting">
          <h2>{greeting}, {user.firstName}</h2>
        </div>

        <div className="nav-actions">
          <select value={selectedSector} onChange={(event) => setSelectedSector(event.target.value)}>
            {sectors.map((sector) => (
              <option value={sector} key={sector}>{sector}</option>
            ))}
          </select>

          <select value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)}>
            {companies.map((company) => (
              <option value={company} key={company}>{company}</option>
            ))}
          </select>

          {user.isAdmin && (
            <button
              type="button"
              className={`nav-tab ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => setActiveView('users')}
            >
              Users
            </button>
          )}

          <div className="user-menu" ref={userMenuRef}>
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsUserMenuOpen((value) => !value)}
            >
              👤
            </button>

            {isUserMenuOpen && (
              <div className="dropdown-menu">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('settings')
                    setIsUserMenuOpen(false)
                  }}
                >
                  Settings
                </button>
                <button type="button" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="main-content">
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        {activeView === 'home' && (
          <section className="home-section">
            <div className="home-card-grid">
              <article className="card home-insight-card">
                <h3>Performance Highlights</h3>
                <p className="card-subtitle">Where your client wins and where it slips vs. peers</p>
                <div className="gradient-line" />
                <p>Track where client performance stands out or underperforms versus sector peers.</p>
              </article>

              <article className="card home-insight-card">
                <h3>Material Topic Benchmark</h3>
                <p className="card-subtitle">How your client’s priorities stack up across competitors</p>
                <div className="gradient-line" />

                {isMaterialTopicLoading && (
                  <p>Loading material topic comparison...</p>
                )}

                {!isMaterialTopicLoading && materialTopicComparison && (
                  <div className="benchmark-table-wrap">
                    <table className="benchmark-table">
                      <thead>
                        <tr>
                          <th>{materialTopicComparison.selectedCompany} Material Topics</th>
                          {materialTopicComparison.competitorCompanies.map((companyName) => (
                            <th key={companyName}>{companyName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {materialTopicComparison.rows.map((row) => (
                          <tr key={row.materialTopic}>
                            <td>{row.materialTopic}</td>
                            {materialTopicComparison.competitorCompanies.map((companyName) => (
                              <td key={`${row.materialTopic}-${companyName}`} className="benchmark-status-cell">
                                {row.competitorMatches[companyName] ? (
                                  <span className="status-tick" title="Present">✓</span>
                                ) : (
                                  <span className="status-cross" title="Not Present">✕</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!isMaterialTopicLoading && !materialTopicComparison && (
                  <p>No material topic data available for this selection.</p>
                )}
              </article>

              <article className="card home-insight-card">
                <h3>Strategic Actions</h3>
                <p className="card-subtitle">High-conviction moves to open strategic client conversations</p>
                <div className="gradient-line" />

                {isRecommendationsLoading && (
                  <p>Loading strategic actions...</p>
                )}

                {!isRecommendationsLoading && recommendations && recommendations.actions?.length > 0 && (
                  <ol className="recommendation-list">
                    {recommendations.actions.map((action) => (
                      <li key={action.topic}>
                        <p className="recommendation-topic">{action.topic}</p>
                        {action.details?.length > 0 && (
                          <ul className="recommendation-details">
                            {action.details.map((detail) => (
                              <li key={detail}>{detail}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {!isRecommendationsLoading && (!recommendations || !recommendations.actions?.length) && (
                  <p>No strategic actions available for this selection.</p>
                )}
              </article>
            </div>

            <div className="home-card-grid-two">
              <article
                className="card home-insight-card interactive-card"
                role="button"
                tabIndex={0}
                onClick={() => setActiveModal('commitments')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveModal('commitments')
                  }
                }}
              >
                <h3>Commitment Progress</h3>
                <p className="card-subtitle">Commitment delivery and peer-positioning at a glance</p>
                <div className="gradient-line" />

                <div className="commitment-infographic">
                  <section className="commitment-summary-band">
                    {isCommitmentOverviewLoading && <p className="commitment-section-message">Loading commitment overview...</p>}
                    {!isCommitmentOverviewLoading && commitmentOverview && (
                      <>
                        <div className="commitment-summary-main">
                          <div className="commitment-total-tile">
                            <span>Total Commitments</span>
                            <strong>{commitmentOverview.totalCommitments}</strong>
                          </div>
                          <div className="commitment-summary-metrics">
                            <article className="commitment-stat-tile positive">
                              <span>Achieved + On-track</span>
                              <strong>{commitmentOverview.achievedOnTrackPct}%</strong>
                            </article>
                            <article className="commitment-stat-tile risk">
                              <span>Off-track</span>
                              <strong>{commitmentOverview.offTrackPct}%</strong>
                            </article>
                          </div>
                        </div>
                      </>
                    )}
                    {!isCommitmentOverviewLoading && !commitmentOverview && (
                      <p className="commitment-section-message">No commitment overview available.</p>
                    )}
                  </section>

                  <div className="commitment-focus-grid">
                    <section className="commitment-focus-card leading">
                      <div className="commitment-focus-head">
                        <h4>Leading Themes</h4>
                        <span className="theme-count positive">{(commitmentOverview?.leadingThemes || []).length}</span>
                      </div>
                      <p className="commitment-focus-caption">Areas where execution is strongest</p>
                      {isCommitmentOverviewLoading && <p className="commitment-section-message">Loading themes...</p>}
                      {!isCommitmentOverviewLoading && !!(commitmentOverview?.leadingThemes || []).length && (
                        <ul className="commitment-theme-list">
                          {(commitmentOverview?.leadingThemes || []).map((theme) => (
                            <li key={theme} className="theme-pill positive">{theme}</li>
                          ))}
                        </ul>
                      )}
                      {!isCommitmentOverviewLoading && !(commitmentOverview?.leadingThemes || []).length && (
                        <p className="commitment-section-message">No leading themes available.</p>
                      )}
                    </section>

                    <section className="commitment-focus-card gaps">
                      <div className="commitment-focus-head">
                        <h4>Gaps</h4>
                        <span className="theme-count risk">{(commitmentOverview?.laggingThemes || []).length}</span>
                      </div>
                      <p className="commitment-focus-caption">Themes requiring intervention now</p>
                      {isCommitmentOverviewLoading && <p className="commitment-section-message">Loading gaps...</p>}
                      {!isCommitmentOverviewLoading && !!(commitmentOverview?.laggingThemes || []).length && (
                        <ul className="commitment-theme-list">
                          {(commitmentOverview?.laggingThemes || []).map((theme) => (
                            <li key={theme} className="theme-pill risk">{theme}</li>
                          ))}
                        </ul>
                      )}
                      {!isCommitmentOverviewLoading && !(commitmentOverview?.laggingThemes || []).length && (
                        <p className="commitment-section-message">No gap themes available.</p>
                      )}
                    </section>
                  </div>
                </div>
              </article>

              <article
                className="card home-insight-card interactive-card"
                role="button"
                tabIndex={0}
                onClick={() => setActiveModal('investment')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveModal('investment')
                  }
                }}
              >
                <h3>Investment Intelligence</h3>
                <p className="card-subtitle">Deals, green capex, and strategic intent at a glance</p>
                <div className="gradient-line" />

                <div className="investment-infographic">
                  {isInvestmentInsightsLoading && <p className="commitment-section-message">Loading investment insights...</p>}

                  {!isInvestmentInsightsLoading && investmentInsights && (
                    <section className="investment-intel-layout">
                      <div className="investment-intel-top-row">
                        <div className="investment-intel-kpi-column">
                          <article className="commitment-total-tile investment-intel-kpi-card">
                            <span>Total Deals in Sustainability</span>
                            <strong>{investmentInsights.summary?.dealCount || 0}</strong>
                          </article>
                          <article className="commitment-total-tile investment-intel-kpi-card">
                            <span>Total Green Capex Investment</span>
                            <strong>{investmentInsights.summary?.greenCapexCount || 0}</strong>
                          </article>
                        </div>

                        <section className="investment-intel-trend-card">
                          <h4>% Deals Related to Sustainability (Last 3 Years)</h4>
                          <p className="investment-intel-chart-note">Bars = selected player, line = peer average (mock data)</p>
                          <SustainabilityDealsTrendChart data={investmentTrendData} />
                        </section>
                      </div>

                      <section className="investment-intel-focus-table-wrap">
                        <table className="investment-intel-focus-table">
                          <thead>
                            <tr>
                              <th>Player Group</th>
                              <th>Sustainability Deal Focus</th>
                              <th>Green Capex Investment Focus</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>{selectedCompany || 'Selected player'}</td>
                              <td>
                                <div className="investment-topic-cell-list">
                                  {investmentFocusMatrix.selectedDealFocus.map((topic) => (
                                    <span key={`selected-deal-${topic}`} className="investment-chip">{topic}</span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <div className="investment-topic-cell-list">
                                  {investmentFocusMatrix.selectedCapexFocus.map((topic) => (
                                    <span key={`selected-capex-${topic}`} className="investment-chip">{topic}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td>Peers</td>
                              <td>
                                <div className="investment-topic-cell-list">
                                  {investmentFocusMatrix.peerDealFocus.map((topic) => (
                                    <span key={`peer-deal-${topic}`} className="investment-chip">{topic}</span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <div className="investment-topic-cell-list">
                                  {investmentFocusMatrix.peerCapexFocus.map((topic) => (
                                    <span key={`peer-capex-${topic}`} className="investment-chip">{topic}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </section>
                    </section>
                  )}

                  {!isInvestmentInsightsLoading && !investmentInsights && (
                    <p className="commitment-section-message">No investment insight data available for this selection.</p>
                  )}
                </div>
              </article>
            </div>

            <div className="home-card-grid-one">
              <article
                className="card home-insight-card interactive-card"
                role="button"
                tabIndex={0}
                onClick={() => setActiveModal('kpi')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveModal('kpi')
                  }
                }}
              >
                <h3>KPI Momentum</h3>
                <p className="card-subtitle">Performance signal strength across sustainability KPIs</p>
                <div className="gradient-line" />

                <div className="kpi-infographic-layout">
                  <section className="kpi-hero-section">
                    <div className="kpi-hero-main">
                      <strong>{kpiTrendSummary.improvingCount}/{kpiTrendSummary.total || 0}</strong>
                      <span>KPIs improving</span>
                    </div>
                    <div className="kpi-signal-row">
                      <span className="kpi-signal-chip improving">↑ Improving {kpiTrendSummary.improvingCount}</span>
                      <span className="kpi-signal-chip stable">→ Stable {kpiTrendSummary.stableCount}</span>
                      <span className="kpi-signal-chip risk">↓ At Risk {kpiTrendSummary.riskCount}</span>
                    </div>
                  </section>

                  <div className="kpi-infographic-grid">
                    {kpiInsights.metrics.map((metric) => {
                      const trend = (metric.trend || '').toLowerCase()
                      const trendClass = trend === 'improving' ? 'improving' : trend === 'stable' ? 'stable' : 'risk'
                      return (
                        <article key={metric.label} className={`kpi-infographic-item ${trendClass}`}>
                          <div className="kpi-item-header">
                            <p>{metric.label}</p>
                            <em className={`kpi-trend-tag ${trendClass}`}>{metric.trend}</em>
                          </div>
                          <strong>{metric.value}</strong>
                        </article>
                      )
                    })}
                  </div>
                </div>
              </article>
            </div>
          </section>
        )}

        {activeView === 'scorecard' && (
          <section className="scorecard-page">
            <div className="settings-header">
              <h2>Commitment Scorecard</h2>
              <button type="button" className="btn-ghost" onClick={() => setActiveView('home')}>Back to Dashboard</button>
            </div>
            <p className="body-subtitle">Achieved + On-track distribution across sector players</p>

            <section className="card scorecard-chart-card">
              <h3 className="scorecard-chart-title">Commitment Progress benchmark</h3>
              <div className="scorecard-thin-divider" />
              {isCommitmentOverviewLoading && <p>Loading score distribution...</p>}
              {!isCommitmentOverviewLoading && !!(commitmentOverview?.ranking || []).length && (
                <div className="score-vertical-layout">
                  <CommitmentProgressChart ranking={commitmentOverview?.ranking || []} />

                  <aside className="score-segment-legend">
                    <h4>Legend</h4>
                    <div><i className="legend-block achieved" /> Achieved</div>
                    <div><i className="legend-block ontrack" /> On-Track</div>
                    <div><i className="legend-block offtrack" /> Off-Track</div>
                    <div><i className="legend-block noreporting" /> Not Reporting</div>
                    <div><i className="legend-block others" /> No-target</div>
                  </aside>
                </div>
              )}

              {!isCommitmentOverviewLoading && !(commitmentOverview?.ranking || []).length && <p>No score distribution data available.</p>}
            </section>

            <section className="card scorecard-table-card">
              <div className="scorecard-table-head">
                <h3>Scorecard</h3>
                <button type="button" className="btn-ghost" onClick={() => setActiveModal('methodology')}>Methodology</button>
              </div>
              <div className="gradient-line" />

              <div className="score-scale-legend">
                <div className="score-scale-legend-track">
                  <div className="status-scale-gradient" />
                  <div className="score-scale-legend-labels">
                    <span>X (No Commitments)</span>
                    <span>A (Active)</span>
                    <span>P (Pro-Active)</span>
                    <span>L (Leading)</span>
                    <span>D (Distinctive)</span>
                  </div>
                </div>
                <div className="score-scale-meta">
                  <span className="scale-marker-legend-item company"><i className="scale-marker-legend-line" />C = Client</span>
                  <span className="scale-marker-legend-item peer"><i className="scale-marker-legend-triangle up" />P = Peer Avg</span>
                  <span className="scale-marker-legend-item best"><i className="scale-marker-legend-triangle down" />B = Best</span>
                </div>
              </div>

              {isScorecardLoading && <p>Loading scorecard table...</p>}

              {!isScorecardLoading && scorecardData && (
                <div className="table-wrap scorecard-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Theme</th>
                        <th>Overall Status</th>
                        <th>Progress</th>
                        <th>Best Practices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(scorecardData.rows || []).map((row) => (
                        <tr key={row.theme}>
                          <td>{row.theme}</td>
                          <td>
                            <StatusScaleCell
                              overallStatus={row.overallStatus}
                              peerAverage={row.peerAverage}
                              bestScore={row.bestScore}
                            />
                          </td>
                          <td>{row.progress || 'Pending logic'}</td>
                          <td>
                            <strong>{row.bestPlayer}</strong>
                            <p className="best-practice-text">{row.bestPractice}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!isScorecardLoading && !scorecardData && (
                <div className="scorecard-placeholder">
                  No scorecard data available for this sector/company.
                </div>
              )}
            </section>
          </section>
        )}

        {activeView === 'investments' && (
          <section className="scorecard-page">
            <div className="settings-header">
              <h2>Investment Deep Dive</h2>
              <button type="button" className="btn-ghost" onClick={() => setActiveView('home')}>Back to Dashboard</button>
            </div>
            <p className="body-subtitle">Topic and region positioning vs peers, plus multi-year investment + green capex trajectory</p>

            <section className="card scorecard-chart-card">
              <h3 className="scorecard-chart-title">Investment Snapshot</h3>
              <div className="scorecard-thin-divider" />
              {isInvestmentInsightsLoading && <p>Loading investment snapshot...</p>}
              {!isInvestmentInsightsLoading && investmentInsights && (
                <div className="investment-deep-grid">
                  <article className="investment-deep-tile">
                    <span>Total Deals</span>
                    <strong>{investmentInsights.summary?.dealCount || 0}</strong>
                  </article>
                  <article className="investment-deep-tile highlight">
                    <span>Total Green Capex</span>
                    <strong>{investmentInsights.summary?.greenCapexCount || 0}</strong>
                  </article>
                  <article className="investment-deep-tile">
                    <span>Closed Deals</span>
                    <strong>{investmentInsights.summary?.closedDealCount || 0}</strong>
                  </article>
                  <article className="investment-deep-tile">
                    <span>Top Region Share</span>
                    <strong>
                      {investmentInsights.summary?.topRegion
                        ? `${investmentInsights.summary.topRegion} ${formatPct(investmentInsights.summary?.topRegionSharePct)}`
                        : 'N/A'}
                    </strong>
                  </article>
                </div>
              )}
              {!isInvestmentInsightsLoading && !investmentInsights && <p>No investment insights available.</p>}
            </section>

            {!isInvestmentInsightsLoading && investmentInsights && (
              <div className="investment-chart-grid">
                <InvestmentStackedChart
                  title={`Sustainability Topic Mix (${selectedCompany} vs Peers)`}
                  breakdown={investmentInsights.charts?.topics}
                />
                <InvestmentStackedChart
                  title={`Region Mix (${selectedCompany} vs Peers)`}
                  breakdown={investmentInsights.charts?.regions}
                />
              </div>
            )}

            <section className="card scorecard-table-card">
              <div className="scorecard-table-head">
                <h3>Investment & Green Capex Timeline (Last 2-3 Years)</h3>
              </div>
              <div className="gradient-line" />

              {isInvestmentInsightsLoading && <p>Loading timeline...</p>}
              {!isInvestmentInsightsLoading && investmentInsights && (
                <div className="investment-timeline-wrap">
                  {(investmentInsights.timeline?.years || []).map((yearBlock) => (
                    <section key={yearBlock.year} className="timeline-year-column">
                      <header className="timeline-year-head">
                        <h4>{yearBlock.year}</h4>
                        <p>{yearBlock.summary}</p>
                      </header>

                      <div className="timeline-event-list">
                        {(yearBlock.events || []).map((event, index) => (
                          <article key={`${event.title}-${event.date}-${index}`} className="timeline-event-card">
                            <span className={`timeline-source-chip ${event.source === 'Green Capex' ? 'capex' : 'deal'}`}>
                              {event.source}
                            </span>
                            <h5>{event.title}</h5>
                            <p>{event.headline || 'No summary available.'}</p>
                            <div className="timeline-event-meta">
                              <span>{event.date || 'NA'}</span>
                              <span>{event.theme || 'Unspecified theme'}</span>
                              <span>{event.region || 'Other'}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                  {!(investmentInsights.timeline?.years || []).length && <p>No timeline data available.</p>}
                </div>
              )}
            </section>
          </section>
        )}

        {activeView === 'settings' && (
          <section className="card settings-card">
            <div className="settings-header">
              <h2>Settings</h2>
              <button type="button" className="btn-ghost" onClick={() => setActiveView('home')}>Close</button>
            </div>
            <div className="gradient-line" />

            <form className="settings-form" onSubmit={handleSaveProfile}>
              <label>First Name</label>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required />

              <label>Last Name</label>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} required />

              <label>Email ID</label>
              <input value={user.email} disabled />

              <button type="submit" className="btn-primary">Save Profile</button>
            </form>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowChangePassword((value) => !value)}
            >
              Change Password
            </button>

            {showChangePassword && (
              <form className="settings-form password-form" onSubmit={handleSettingsPasswordChange}>
                <label>Current Password</label>
                <input
                  type="password"
                  value={settingsCurrentPassword}
                  onChange={(event) => setSettingsCurrentPassword(event.target.value)}
                  required
                />

                <label>New Password</label>
                <input
                  type="password"
                  value={settingsNewPassword}
                  onChange={(event) => setSettingsNewPassword(event.target.value)}
                  required
                />

                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={settingsConfirmPassword}
                  onChange={(event) => setSettingsConfirmPassword(event.target.value)}
                  required
                />

                <button type="submit" className="btn-primary">Update Password</button>
              </form>
            )}
          </section>
        )}

        {activeView === 'users' && user.isAdmin && (
          <section className="card users-card">
            <div className="settings-header">
              <h2>Users</h2>
              <button type="button" className="btn-ghost" onClick={resetAdminForm}>New User</button>
            </div>
            <div className="gradient-line" />

            <form className="admin-user-form" onSubmit={handleAdminUserSubmit}>
              <div className="form-grid">
                <div>
                  <label>Email ID</label>
                  <input
                    type="email"
                    value={adminFormEmail}
                    disabled={!!editingUserId}
                    onChange={(event) => setAdminFormEmail(event.target.value)}
                    required
                  />
                </div>

                <div>
                  <label>{editingUserId ? 'New Password (optional)' : 'Password'}</label>
                  <input
                    type="password"
                    value={adminFormPassword}
                    onChange={(event) => setAdminFormPassword(event.target.value)}
                  />
                </div>

                <div>
                  <label>First Name</label>
                  <input value={adminFormFirstName} onChange={(event) => setAdminFormFirstName(event.target.value)} required />
                </div>

                <div>
                  <label>Last Name</label>
                  <input value={adminFormLastName} onChange={(event) => setAdminFormLastName(event.target.value)} required />
                </div>
              </div>

              <div>
                <label>Assigned Sectors</label>
                <div className="sector-checkbox-grid">
                  {allSectors.map((sector) => (
                    <label key={sector} className="sector-checkbox">
                      <input
                        type="checkbox"
                        checked={adminFormSectors.includes(sector)}
                        onChange={() => toggleAdminSector(sector)}
                      />
                      <span>{sector}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="sector-checkbox inline-checkbox">
                <input
                  type="checkbox"
                  checked={adminFormIsAdmin}
                  onChange={(event) => setAdminFormIsAdmin(event.target.checked)}
                />
                <span>Admin access</span>
              </label>

              <div className="admin-form-actions">
                <button type="submit" className="btn-primary">{editingUserId ? 'Update User' : 'Add User'}</button>
                {editingUserId && <button type="button" className="btn-secondary" onClick={resetAdminForm}>Cancel Edit</button>}
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User ID (Email)</th>
                    <th>Password</th>
                    <th>Name</th>
                    <th>Added Sector(s)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.email}</td>
                      <td>{item.maskedPassword || '********'}</td>
                      <td>{item.firstName} {item.lastName}</td>
                      <td>{(item.sectors || []).join(', ') || '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="btn-ghost" onClick={() => handleEditUser(item)}>Edit</button>
                          <button type="button" className="btn-secondary" onClick={() => handleDeleteUser(item)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {activeModal === 'commitments' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card commitment-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Commitment Progress - {selectedCompany}</h3>
              <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Close</button>
            </div>

            <section className="modal-commitment-hero">
              <p>Execution Snapshot</p>
              {isCommitmentOverviewLoading && <p className="commitment-section-message">Loading commitment metrics...</p>}
              {!isCommitmentOverviewLoading && commitmentOverview && (
                <>
                  <div className="modal-commitment-stats">
                    <article>
                      <span>Total Commitments</span>
                      <strong>{commitmentOverview.totalCommitments}</strong>
                    </article>
                    <article className="positive">
                      <span>Achieved + On-track</span>
                      <strong>{commitmentOverview.achievedOnTrackPct}%</strong>
                    </article>
                    <article className="risk">
                      <span>Off-track</span>
                      <strong>{commitmentOverview.offTrackPct}%</strong>
                    </article>
                  </div>
                </>
              )}
              {!isCommitmentOverviewLoading && !commitmentOverview && (
                <p className="commitment-section-message">No commitment overview available.</p>
              )}
            </section>

            <div className="modal-two-column commitment-modal-grid">
              <section className="modal-pane commitment-pane-chart">
                <h4>Theme Score Snapshot</h4>
                {isScorecardLoading && <p>Loading theme comparison...</p>}
                {!isScorecardLoading && <ThemeSpiderChart data={scorecardData?.radarThemes || []} companyName={selectedCompany} />}
              </section>

              <section className="modal-pane commitment-pane-actions">
                <h4>Action Priorities</h4>
                <ul className="modal-priority-list">
                  {(scorecardData?.priorityMoves || []).map((move) => (
                    <li key={move}>{move}</li>
                  ))}
                </ul>
                {!isScorecardLoading && !(scorecardData?.priorityMoves || []).length && (
                  <p>No priority moves available.</p>
                )}
              </section>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setActiveModal(null)
                  setActiveView('scorecard')
                }}
              >
                Scorecard
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'kpi' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card kpi-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>KPI Momentum - {selectedCompany}</h3>
              <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Close</button>
            </div>

            <section className="modal-kpi-hero">
              <div className="modal-kpi-hero-main">
                <strong>{kpiTrendSummary.improvingCount}/{kpiTrendSummary.total || 0}</strong>
                <span>KPIs improving</span>
              </div>
              <div className="kpi-signal-row">
                <span className="kpi-signal-chip improving">↑ Improving {kpiTrendSummary.improvingCount}</span>
                <span className="kpi-signal-chip stable">→ Stable {kpiTrendSummary.stableCount}</span>
                <span className="kpi-signal-chip risk">↓ At Risk {kpiTrendSummary.riskCount}</span>
              </div>
            </section>

            <div className="modal-kpi-grid">
              {kpiInsights.metrics.map((metric) => {
                const trend = (metric.trend || '').toLowerCase()
                const trendClass = trend === 'improving' ? 'improving' : trend === 'stable' ? 'stable' : 'risk'
                return (
                  <article key={metric.label} className={`modal-kpi-item ${trendClass}`}>
                    <div className="modal-kpi-item-head">
                      <span>{metric.label}</span>
                      <em className={`kpi-trend-tag ${trendClass}`}>{metric.trend}</em>
                    </div>
                    <strong>{metric.value}</strong>
                  </article>
                )
              })}
            </div>

            <section className="modal-pane">
              <h4>Suggested Focus Areas</h4>
              <ul className="modal-priority-list">
                {kpiInsights.moves.map((move) => (
                  <li key={move}>{move}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {activeModal === 'investment' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card commitment-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Investment Intelligence - {selectedCompany}</h3>
              <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Close</button>
            </div>

            <section className="modal-commitment-hero">
              <p>Capital Allocation Snapshot</p>
              {isInvestmentInsightsLoading && <p className="commitment-section-message">Loading investment metrics...</p>}
              {!isInvestmentInsightsLoading && investmentInsights && (
                <section className="investment-snapshot-grid">
                  <div className="investment-left-stack">
                    <article className="commitment-total-tile">
                      <span>Total Deals</span>
                      <strong>{investmentInsights.summary?.dealCount || 0}</strong>
                    </article>
                    <article className="commitment-total-tile">
                      <span>Green Capex Investments</span>
                      <strong>{investmentInsights.summary?.greenCapexCount || 0}</strong>
                    </article>
                  </div>

                  <div className="investment-right-stack">
                    <section className="investment-strategy-block tone-positive">
                      <h4>Investment Focus</h4>
                      <p className="investment-focus-line">
                        {investmentInsights.investmentFocus || 'Refocus portfolio toward resilient sustainability bets'}
                      </p>
                    </section>

                    <section className="investment-strategy-block tone-neutral">
                      <h4>Region Shares</h4>
                      <ul className="investment-simple-list">
                        {(investmentInsights.regionShares || []).slice(0, 4).map((item) => (
                          <li key={item.region}>{item.region}: {formatPct(item.sharePct)}</li>
                        ))}
                      </ul>
                    </section>

                    <section className="investment-strategy-block tone-neutral">
                      <h4>Top Sustainability Topics</h4>
                      <ul className="investment-simple-list">
                        {(investmentInsights.topSustainabilityTopics || []).slice(0, 2).map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </section>
              )}
              {!isInvestmentInsightsLoading && !investmentInsights && (
                <p className="commitment-section-message">No investment snapshot available.</p>
              )}
            </section>

            <div className="modal-two-column commitment-modal-grid">
              <section className="modal-pane commitment-pane-chart">
                <h4>Sustainable Topic vs Peer Avg</h4>
                {!isInvestmentInsightsLoading && (
                  <ThemeSpiderChart data={investmentInsights?.spider?.topics || []} companyName={selectedCompany} />
                )}
              </section>

              <section className="modal-pane commitment-pane-chart">
                <h4>Region Mix vs Peer Avg</h4>
                {!isInvestmentInsightsLoading && (
                  <ThemeSpiderChart data={investmentInsights?.spider?.regions || []} companyName={selectedCompany} />
                )}
              </section>
            </div>

            <section className="modal-pane commitment-pane-actions investment-strategy-block tone-risk">
              <h4>Nestle vs peers</h4>
              <ul className="modal-priority-list">
                {(investmentInsights?.differenceBullets || []).slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setActiveModal(null)
                  setActiveView('investments')
                }}
              >
                Open Investment Deep Dive
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'methodology' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Methodology</h3>
              <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Close</button>
            </div>

            <ul className="modal-priority-list">
              <li>Each theme is scored on 5 parameters (0–10): Existence & Specificity, Ambition, Coverage, Credibility & Transparency, Delivery/Status.</li>
              <li>Average parameter score is doubled and added to the bucket base score.</li>
              <li>Bucket base: X=0, A=20, P=40, L=60, D=80, resulting in a final 0–100 score.</li>
              <li>Overall status scale shows Client (C), Peer Avg (P), and Best (B) positions for direct comparison.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
