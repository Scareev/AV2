import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

type User = { usuario: string; papel: string };
type Section = "Visão geral" | "Organizações" | "Lotes" | "Equipamentos" | "Relatórios";
const sections: Section[] = ["Visão geral", "Organizações", "Lotes", "Equipamentos", "Relatórios"];

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("greencode-token") ?? "");
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem("greencode-user");
    return saved ? JSON.parse(saved) as User : null;
  });
  const [section, setSection] = useState<Section>("Visão geral");
  const [notice, setNotice] = useState("");

  const logout = () => {
    sessionStorage.removeItem("greencode-token");
    sessionStorage.removeItem("greencode-user");
    setToken(""); setUser(null);
  };

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`/api${path}`, {
      ...init,
      headers: (() => { const headers = new Headers(init.headers); if (!headers.has("content-type")) headers.set("content-type", "application/json"); if (token) headers.set("authorization", `Bearer ${token}`); return headers; })()
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.erro ?? `Falha na solicitação (${response.status}).`);
    return body;
  }, [token]);

  useEffect(() => { if (token) void request("/health").catch((error: Error) => setNotice(error.message)); }, [request, token]);

  if (!token || !user) {
    return <Login onLogin={(accessToken, account) => {
      sessionStorage.setItem("greencode-token", accessToken);
      sessionStorage.setItem("greencode-user", JSON.stringify(account));
      setToken(accessToken); setUser(account); setNotice("");
    }} />;
  }

  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="#inicio"><span className="brand-mark">G</span><span>green<span className="brand-light">code</span><small>LOGÍSTICA REVERSA</small></span></a>
      <div className="nav-label">PLATAFORMA</div>
      <nav>{sections.map((item, index) => <button key={item} className={`nav-item ${section === item ? "active" : ""}`} onClick={() => { setSection(item); setNotice(""); }}><span className="nav-icon">{["⌂", "▦", "▤", "◈", "▥"][index]}</span>{item}{item === "Visão geral" && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><span className="online-dot" /> API conectada <span className="version">AV2</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="crumb">GreenCode <span>/</span> {section}</div><div className="top-user"><span className="avatar">{user.usuario.slice(0, 1).toUpperCase()}</span><span><b>{user.usuario}</b><small>{user.papel}</small></span><button className="logout" onClick={logout} title="Sair">↗</button></div></header>
      <div className="content">
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {section === "Visão geral" ? <Dashboard request={request} /> : <DataSection key={section} section={section} request={request} onNotice={setNotice} />}
      </div>
      <footer>GreenCode <span>•</span> Plataforma de logística reversa <span className="footer-right">Desenvolvido para AV2</span></footer>
    </main>
  </div>;
}

function Login({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario: username, senha: password }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.erro ?? "Não foi possível entrar.");
      onLogin(body.token, body.usuario);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao conectar à API."); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><section className="login-art"><div className="art-brand"><span className="brand-mark">G</span> green<span>code</span></div><div className="art-copy"><span className="eyebrow">TECNOLOGIA QUE REGENERA</span><h1>O futuro é<br /><em>circular.</em></h1><p>Gestão inteligente de logística reversa para um mundo com menos resíduos e mais possibilidades.</p></div><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-foot">CUIDAR DO CICLO É CUIDAR DO AMANHÃ <span>↗</span></div></section>
    <section className="login-panel"><div className="login-box"><div className="login-symbol">↗</div><span className="eyebrow dark-eyebrow">ÁREA RESTRITA</span><h2>Bem-vindo de volta</h2><p className="login-subtitle">Entre com suas credenciais para acessar a plataforma.</p><form onSubmit={submit}><label htmlFor="username">Usuário</label><input id="username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required /><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />{error && <div className="form-error">{error}</div>}<button className="primary-button login-button" disabled={busy}>{busy ? "Entrando…" : "Entrar na plataforma"}<span>→</span></button></form><small className="secure-note">⌑ Conexão protegida por autenticação JWT</small></div><div className="login-copyright">© 2026 GreenCode <span>•</span> Logística reversa</div></section></div>;
}

function Dashboard({ request }: { request: (path: string, init?: RequestInit) => Promise<any> }) {
  const [stats, setStats] = useState({ organizations: 0, lots: 0, equipment: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([request("/organizacoes"), request(`/lotes?dataInicio=${new Date(2000, 0, 1).toISOString()}&dataFim=${new Date(2100, 0, 1).toISOString()}`), request("/equipamentos")])
      .then(([organizations, lots, equipment]) => setStats({ organizations: organizations.length, lots: lots.length, equipment: equipment.length }))
      .catch(() => undefined).finally(() => setLoading(false));
  }, [request]);
  return <><div className="page-heading"><div><span className="eyebrow dark-eyebrow">PAINEL DE CONTROLE</span><h1>Visão geral</h1><p>Acompanhe a operação de logística reversa em um só lugar.</p></div><div className="today"><span className="today-icon">◷</span><span><small>HOJE</small><b>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date())}</b></span></div></div>
    <div className="welcome-banner"><div><span className="banner-kicker">CICLO CONSCIENTE, IMPACTO POSITIVO</span><h2>Todo ciclo merece<br />um <em>novo começo.</em></h2><p>Gerencie recursos, acompanhe materiais e transforme logística em impacto.</p></div><div className="leaf-art"><span>↗</span></div><div className="banner-index">01 <i /> 03</div></div>
    <div className="section-title"><div><h2>Resumo da operação</h2><p>Indicadores gerais da plataforma</p></div><span className="live-label"><i /> DADOS AO VIVO</span></div>
    <div className="stats-grid"><StatCard title="Organizações" value={stats.organizations} icon="▦" detail="parceiros cadastrados" tone="mint" loading={loading} /><StatCard title="Lotes recebidos" value={stats.lots} icon="▤" detail="lotes na plataforma" tone="sand" loading={loading} /><StatCard title="Equipamentos" value={stats.equipment} icon="◈" detail="itens rastreados" tone="blue" loading={loading} /></div>
    <div className="lower-grid"><article className="info-card"><div className="card-heading"><div><span className="eyebrow dark-eyebrow">COMO ESTAMOS</span><h3>Operação em movimento</h3></div><span className="card-icon">↗</span></div><p>Use o menu para cadastrar organizações, receber lotes e acompanhar a jornada de cada equipamento.</p><div className="mini-flow"><span>COLETA</span><i>→</i><span>TRIAGEM</span><i>→</i><span>DESTINO</span></div></article><article className="info-card api-card"><div className="card-heading"><div><span className="eyebrow dark-eyebrow">SISTEMA</span><h3>Serviços disponíveis</h3></div><span className="status-pill"><i /> Online</span></div><div className="service-row"><span>API REST</span><b>Conectada</b></div><div className="service-row"><span>Autenticação</span><b>JWT ativo</b></div><div className="service-row"><span>Documentação</span><a href="/docs" target="_blank" rel="noreferrer">Abrir OpenAPI ↗</a></div></article></div>
  </>;
}

function StatCard({ title, value, icon, detail, tone, loading }: { title: string; value: number; icon: string; detail: string; tone: string; loading: boolean }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{title}</span><div className="stat-value">{loading ? "—" : value}</div><div className="stat-detail">{detail}<span>↗</span></div></article>;
}

function DataSection({ section, request, onNotice }: { section: Section; request: (path: string, init?: RequestInit) => Promise<any>; onNotice: (message: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const endpoint = section === "Organizações" ? "/organizacoes" : section === "Lotes" ? `/lotes?dataInicio=${encodeURIComponent(filter || new Date(2000, 0, 1).toISOString())}&dataFim=${encodeURIComponent(new Date(2100, 0, 1).toISOString())}` : section === "Equipamentos" ? "/equipamentos" : `/relatorios/equipamentos?status=${encodeURIComponent(filter || "AGUARDANDO_TRIAGEM")}`;
  const refresh = useCallback(() => { setLoading(true); request(endpoint).then(data => setItems(Array.isArray(data) ? data : data?.dados ?? data?.equipamentos ?? data?.lotes ?? [])).catch((error: Error) => onNotice(error.message)).finally(() => setLoading(false)); }, [endpoint, onNotice, request]);
  useEffect(() => { refresh(); }, [refresh]);
  const fields = section === "Organizações" ? [["cnpj", "CNPJ"], ["razaoSocial", "Razão social"], ["enderecoCompleto", "Endereço completo"], ["email", "E-mail"], ["telefone", "Telefone"]] : section === "Lotes" ? [["organizacaoId", "ID da organização"], ["notaFiscal", "Nota fiscal"], ["transportadora", "Transportadora"], ["dataEntrada", "Data de entrada (opcional)"]] : section === "Equipamentos" ? [["codigoBarrasInterno", "Código de barras"], ["tipo", "Tipo (enum)"], ["marca", "Marca"], ["modelo", "Modelo"], ["anoFabricacao", "Ano de fabricação"], ["estadoFisico", "Estado físico (enum)"], ["pesoQuilogramas", "Peso em kg"], ["loteId", "ID do lote"], ["posicaoNoLote", "Posição no lote"]] : [];
  async function create(event: FormEvent) { event.preventDefault(); try { const payload: Record<string, unknown> = { ...form }; for (const field of ["anoFabricacao", "pesoQuilogramas", "posicaoNoLote"]) if (payload[field]) payload[field] = Number(payload[field]); if (payload.dataEntrada) payload.dataEntrada = new Date(String(payload.dataEntrada)).toISOString(); else delete payload.dataEntrada; await request(section === "Organizações" ? "/organizacoes" : section === "Lotes" ? "/lotes" : "/equipamentos", { method: "POST", body: JSON.stringify(payload) }); setForm({}); setFormOpen(false); onNotice("Registro criado com sucesso."); refresh(); } catch (error) { onNotice(error instanceof Error ? error.message : "Falha ao salvar."); } }
  const heading = section === "Relatórios" ? "Relatórios de equipamentos" : section;
  return <><div className="page-heading"><div><span className="eyebrow dark-eyebrow">GESTÃO OPERACIONAL</span><h1>{heading}</h1><p>{section === "Relatórios" ? "Consulte os equipamentos por status de rastreamento." : `Consulte e gerencie ${section.toLowerCase()} da plataforma.`}</p></div>{section !== "Relatórios" && <button className="primary-button create-button" onClick={() => setFormOpen(value => !value)}>{formOpen ? "Fechar" : "+ Novo registro"}</button>}</div>
    {section === "Relatórios" && <div className="toolbar"><label htmlFor="status-filter">Status de rastreamento</label><select id="status-filter" value={filter || "AGUARDANDO_TRIAGEM"} onChange={event => setFilter(event.target.value)}><option value="AGUARDANDO_TRIAGEM">Aguardando triagem</option><option value="EM_TRIAGEM">Em triagem</option><option value="RECUPERADO">Recuperado</option><option value="AGUARDANDO_DESMONTE">Aguardando desmonte</option><option value="DESMONTADO">Desmontado</option></select><button className="secondary-button" onClick={refresh}>Consultar</button></div>}
    {formOpen && <form className="editor-card" onSubmit={create}><div className="editor-title"><h2>Novo registro</h2><span>Preencha os campos para cadastrar</span></div><div className="form-grid">{fields.map(([key, label]) => <label key={key}>{label}<input required value={form[key] ?? ""} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>)}</div><button className="primary-button">Salvar registro <span>→</span></button></form>}
    <div className="table-card"><div className="table-heading"><div><h2>Registros</h2><p>{loading ? "Carregando dados…" : `${items.length} resultado${items.length === 1 ? "" : "s"}`}</p></div><button className="icon-button" onClick={refresh} title="Atualizar">↻</button></div>{loading ? <div className="empty-state">Carregando…</div> : items.length === 0 ? <div className="empty-state"><span>◇</span><b>Nenhum registro encontrado</b><small>Quando houver dados cadastrados, eles aparecerão aqui.</small></div> : <div className="table-scroll"><table><thead><tr>{tableColumns(section).map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={item.id ?? index}>{tableColumns(section).map(column => <td key={column.key}>{renderValue(item, column.key)}</td>)}</tr>)}</tbody></table></div>}</div>
  </>;
}

function tableColumns(section: Section) {
  if (section === "Organizações") return [{ key: "razaoSocial", label: "Organização" }, { key: "cnpj", label: "CNPJ" }, { key: "email", label: "E-mail" }, { key: "contratoVigente", label: "Contrato" }];
  if (section === "Lotes") return [{ key: "notaFiscal", label: "Nota fiscal" }, { key: "dataEntrada", label: "Entrada" }, { key: "organizacao", label: "Organização" }, { key: "equipamentos", label: "Equipamentos" }];
  return [{ key: "codigoBarrasInterno", label: "Código" }, { key: "tipo", label: "Tipo" }, { key: "marca", label: "Marca" }, { key: "estadoFisico", label: "Estado físico" }, { key: "statusRastreamento", label: "Status" }];
}

function renderValue(item: any, key: string): ReactNode {
  const raw = key === "organizacao" ? item.organizacao?.razaoSocial : key === "equipamentos" ? item.equipamentos?.length : key === "contratoVigente" ? item.contratoVigente ? "Ativo" : "—" : item[key];
  if (raw === null || raw === undefined || raw === "") return "—";
  if (key.toLowerCase().includes("status") || key === "estadoFisico" || key === "contratoVigente") return <span className="table-badge">{String(raw).replaceAll("_", " ")}</span>;
  if (key.includes("data")) return new Date(raw).toLocaleDateString("pt-BR");
  return String(raw);
}

export default App;
