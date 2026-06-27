'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase, Member, PendingEdit } from '../lib/supabase'
import { fullName, calcAge, fmtDate, monthNames } from '../lib/utils'

const SAMPLE_MEMBERS: Omit<Member, 'created_at'>[] = [
  { id:'g1m1', name:'José', surname1:'García', surname2:'López', born:'1920-03-15', died:'1995-08-20', gender:'M', generation:1, spouse_id:'g1f1', children_ids:['g2m1','g2f1'], external:false, email:null, bio_birthplace:'Sevilla, España', bio_education:'Primaria', bio_occupation:'Agricultor', bio_notes:null },
  { id:'g1f1', name:'Carmen', surname1:'Ruiz', surname2:'Mora', born:'1923-07-04', died:'2001-01-12', gender:'F', generation:1, spouse_id:'g1m1', children_ids:['g2m1','g2f1'], external:false, email:null, bio_birthplace:'Málaga, España', bio_education:'Primaria', bio_occupation:'Ama de casa', bio_notes:null },
  { id:'g2m1', name:'Antonio', surname1:'García', surname2:'Ruiz', born:'1950-06-22', died:null, gender:'M', generation:2, spouse_id:'g2f1', children_ids:['g3m1','g3f1'], external:false, email:'antonio@email.com', bio_birthplace:'Santiago, Chile', bio_education:'Universidad', bio_occupation:'Ingeniero', bio_notes:null },
  { id:'g2f1', name:'Elena', surname1:'Torres', surname2:'Martínez', born:'1953-09-10', died:null, gender:'F', generation:2, spouse_id:'g2m1', children_ids:['g3m1','g3f1'], external:false, email:'elena@email.com', bio_birthplace:'Valparaíso, Chile', bio_education:'Universidad', bio_occupation:'Profesora', bio_notes:null },
  { id:'g3m1', name:'Carlos', surname1:'García', surname2:'Torres', born:'1975-03-28', died:null, gender:'M', generation:3, spouse_id:null, children_ids:['g4m1'], external:false, email:'carlos@email.com', bio_birthplace:'Santiago, Chile', bio_education:'Universidad', bio_occupation:'Médico', bio_notes:null },
  { id:'g3f1', name:'María', surname1:'García', surname2:'Torres', born:'1978-11-02', died:null, gender:'F', generation:3, spouse_id:null, children_ids:[], external:false, email:null, bio_birthplace:'Santiago, Chile', bio_education:'Universidad', bio_occupation:'Diseñadora', bio_notes:null },
  { id:'g4m1', name:'Diego', surname1:'García', surname2:'Torres', born:'2002-10-14', died:null, gender:'M', generation:4, spouse_id:null, children_ids:[], external:false, email:null, bio_birthplace:null, bio_education:null, bio_occupation:null, bio_notes:null },
]

function Avatar({ p, size=40 }: { p: Member; size?: number }) {
  const bg = p.died ? '#64748b' : p.gender==='M' ? '#2563eb' : '#db2777'
  return (
    <div style={{width:size,height:size,borderRadius:'50%',background:bg,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:size*0.36,fontWeight:700,border:p.external?'2px dashed #94a3b8':'2px solid #fff',flexShrink:0,opacity:p.died?0.7:1}}>
      {p.name[0]}{p.surname1[0]}
    </div>
  )
}

function PersonCard({ person, members, onClose, onEdit, isAdmin }: { person:Member; members:Member[]; onClose:()=>void; onEdit:(p:Member)=>void; isAdmin:boolean }) {
  const spouse = members.find(m=>m.id===person.spouse_id)
  const children = members.filter(m=>person.children_ids?.includes(m.id))
  const parents = members.filter(m=>m.children_ids?.includes(person.id))
  let prevMarriages: Array<{spouse_id:string|null,children_ids:string[]}> = []
  let bioText: string|null = person.bio_notes
  if (person.bio_notes) {
    try {
      const parsed = JSON.parse(person.bio_notes)
      if (Array.isArray(parsed)) { prevMarriages = parsed; bioText = null }
    } catch {}
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',position:'relative',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:14,background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#64748b'}}>×</button>
        <div style={{display:'flex',gap:14,alignItems:'center',marginBottom:18}}>
          <Avatar p={person} size={56}/>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:'#1e293b'}}>{fullName(person)}</div>
            {person.died&&<div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>† In Memoriam</div>}
            {person.external&&<div style={{fontSize:12,color:'#f59e0b',marginTop:2}}>Ingresó por matrimonio</div>}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          {[['Nacimiento',fmtDate(person.born)],['Edad',`${calcAge(person.born,person.died)} años`],person.died?['Fallecimiento',fmtDate(person.died)]:null,spouse?['Cónyuge actual',fullName(spouse)]:null,person.bio_birthplace?['Lugar de nacimiento',person.bio_birthplace]:null,person.bio_occupation?['Ocupación',person.bio_occupation]:null].filter(Boolean).map(([l,v])=>(
            <div key={l as string} style={{background:'#f8fafc',borderRadius:8,padding:'8px 10px'}}>
              <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1}}>{l}</div>
              <div style={{fontSize:13,fontWeight:600,color:'#1e293b',marginTop:2}}>{v}</div>
            </div>
          ))}
        </div>
        {prevMarriages.length>0&&<div style={{marginBottom:12}}>
          {prevMarriages.map((pm,i)=>{
            const pmSpouse=members.find(m=>m.id===pm.spouse_id)
            const pmChildren=members.filter(m=>pm.children_ids.includes(m.id))
            return <div key={i} style={{background:'#f8fafc',borderRadius:8,padding:'8px 10px',marginBottom:6}}>
              <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1}}>1er matrimonio</div>
              {pmSpouse&&<div style={{fontSize:13,fontWeight:600,color:'#1e293b',marginTop:2}}>{fullName(pmSpouse)}</div>}
              {pmChildren.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>{pmChildren.map(c=><Chip key={c.id} p={c}/>)}</div>}
            </div>
          })}
        </div>}
        {bioText&&<div style={{background:'#faf5ff',borderRadius:8,padding:'10px 12px',fontSize:13,color:'#4c1d95',marginBottom:14,fontStyle:'italic'}}>"{bioText}"</div>}
        {parents.length>0&&<div style={{marginBottom:12}}><div style={{fontSize:11,color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Padres</div><div style={{display:'flex',flexWrap:'wrap',gap:6}}>{parents.map(p=><Chip key={p.id} p={p}/>)}</div></div>}
        {children.length>0&&<div style={{marginBottom:12}}><div style={{fontSize:11,color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Hijos ({children.length})</div><div style={{display:'flex',flexWrap:'wrap',gap:6}}>{children.map(p=><Chip key={p.id} p={p}/>)}</div></div>}
        <button onClick={()=>onEdit(person)} style={{marginTop:4,width:'100%',padding:'10px',background:'#1e293b',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600}}>
          {isAdmin?'✏️ Editar':'📝 Proponer cambio'}
        </button>
      </div>
    </div>
  )
}

function Chip({p}:{p:Member}){
  return <div style={{background:p.gender==='M'?'#dbeafe':'#fce7f3',color:p.gender==='M'?'#1d4ed8':'#be185d',borderRadius:20,padding:'4px 10px',fontSize:12,fontWeight:600}}>{p.name} {p.surname1}</div>
}

function MiniCard({person,onSelect,collapsed,onToggleCollapse}:{person:Member;onSelect:(p:Member)=>void;collapsed?:boolean;onToggleCollapse?:()=>void}){
  const isBlood = !person.external
  const bg = isBlood ? (person.gender==='M' ? '#dbeafe' : '#fce7f3') : (person.gender==='M' ? '#f8fafc' : '#fdf4ff')
  const border = isBlood ? '#d97706' : '#94a3b8'
  const borderStyle = isBlood ? 'solid' : 'dashed'
  const borderWidth = isBlood ? '3px' : '1.5px'
  const shadow = isBlood ? '0 2px 10px rgba(217,119,6,0.3)' : '0 1px 4px rgba(0,0,0,0.06)'
  return (
    <div style={{position:'relative'}}>
      <div data-gen={person.generation} onClick={()=>onSelect(person)} style={{background:bg,border:`${borderWidth} ${borderStyle} ${border}`,borderRadius:12,padding:'10px 12px',cursor:'pointer',minWidth:100,textAlign:'center',opacity:person.died?0.75:1,boxShadow:shadow,transition:'transform 0.15s',position:'relative'}}
        onMouseEnter={e=>(e.currentTarget.style.transform='translateY(-2px)')}
        onMouseLeave={e=>(e.currentTarget.style.transform='')}>
        {person.died&&<div style={{position:'absolute',top:-6,right:-6,fontSize:11,background:'#64748b',color:'#fff',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center'}}>†</div>}
        {person.external&&<div style={{position:'absolute',top:-6,left:-6,fontSize:10,background:'#f59e0b',color:'#fff',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center'}}>★</div>}
        <Avatar p={person} size={34}/>
        <div style={{fontSize:11,fontWeight:700,color:'#1e293b',marginTop:4,lineHeight:1.2}}>{person.name}</div>
        <div style={{fontSize:10,color:'#64748b',marginTop:1}}>{person.born?.slice(0,4)}{person.died?`–${person.died.slice(0,4)}`:''}</div>
      </div>
      {onToggleCollapse && (
        <button
          onClick={e=>{e.stopPropagation();onToggleCollapse()}}
          style={{position:'absolute',bottom:-10,left:'50%',transform:'translateX(-50%)',width:20,height:20,borderRadius:'50%',background:'#475569',border:'none',color:'#fff',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,lineHeight:1}}>
          {collapsed ? '▼' : '▲'}
        </button>
      )}
    </div>
  )
}

function sortByIds(members: Member[], ids: string[]): Member[] {
  return [...members].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
}

function getMarriages(person: Member, members: Member[]): Array<{spouse: Member|null, children: Member[], spouseOwnChildren: Member[]}> {
  const allChildren = sortByIds(members.filter(m => person.children_ids?.includes(m.id)), person.children_ids ?? [])
  const currentSpouse = members.find(m => m.id === person.spouse_id) ?? null
  let prevMarriages: Array<{spouse_id: string|null, children_ids: string[], spouse_own_children_ids?: string[]}> = []
  if (person.bio_notes) {
    try {
      let parsed: any = person.bio_notes
      if (typeof parsed === 'string') parsed = JSON.parse(parsed)
      if (Array.isArray(parsed) && parsed.length > 0) prevMarriages = parsed
    } catch(e) {}
  }
  const getSpouseOwnChildren = (spouse: Member|null, explicitIds?: string[]): Member[] => {
    if (explicitIds && explicitIds.length > 0)
      return sortByIds(members.filter(m => explicitIds.includes(m.id)), explicitIds)
    if (!spouse) return []
    const own = members.filter(m => spouse.children_ids?.includes(m.id) && !person.children_ids?.includes(m.id))
    return sortByIds(own, spouse.children_ids ?? [])
  }
  if (prevMarriages.length === 0) {
    return [{ spouse: currentSpouse, children: allChildren, spouseOwnChildren: getSpouseOwnChildren(currentSpouse) }]
  }
  const usedChildIds = new Set<string>()
  const result: Array<{spouse: Member|null, children: Member[], spouseOwnChildren: Member[]}> = []
  for (const pm of prevMarriages) {
    const spouse = members.find(m => m.id === pm.spouse_id) ?? null
    const children = sortByIds(members.filter(m => pm.children_ids.includes(m.id)), pm.children_ids)
    children.forEach(c => usedChildIds.add(c.id))
    result.push({ spouse, children, spouseOwnChildren: getSpouseOwnChildren(spouse, pm.spouse_own_children_ids) })
  }
  const currentChildren = allChildren.filter(c => !usedChildIds.has(c.id))
  result.push({ spouse: currentSpouse, children: currentChildren, spouseOwnChildren: getSpouseOwnChildren(currentSpouse) })
  return result
}

const MARRY_COLOR = "#d97706"
const BLOOD_COLOR = "#475569"
const POLIT_COLOR = "#f59e0b"

function VLine({h, color=BLOOD_COLOR}: {h:number, color?:string}) {
  return <div style={{width:3, height:h, background:color, flexShrink:0, alignSelf:'center'}}/>
}

function UnknownParent({ onAdd, patchContext }: {
  onAdd?: (m: Member) => void,
  patchContext?: { person: Member, marriageIndex: number, field: 'spouse_id' | 'spouse_own_children_ids' }
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [surname1, setSurname1] = useState('')
  const [born, setBorn] = useState('')
  const [gender, setGender] = useState<'M'|'F'>('M')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name || !surname1 || !born) return
    setSaving(true)
    const id = `g_${Date.now()}`
    const newMember: Member = { id, name, surname1, surname2:'', born, died:null, gender,
      generation: patchContext?.person.generation ?? 3,
      spouse_id:null, children_ids:[], external:true, email:null,
      bio_birthplace:null, bio_education:null, bio_occupation:null, bio_notes:null }
    await supabase.rpc('insert_member', { p_member: {
      id, name, surname1, surname2:'', born, died:'', gender,
      generation: patchContext?.person.generation ?? 3,
      spouse_id:'', children_ids:[], external:true, email:'',
      bio_birthplace:'', bio_education:'', bio_occupation:'', bio_notes:''
    }})
    if (patchContext) {
      const { person, marriageIndex, field } = patchContext
      let bioNotes: any[] = []
      try { bioNotes = JSON.parse(person.bio_notes ?? '[]') } catch {}
      if (!Array.isArray(bioNotes)) bioNotes = []
      while (bioNotes.length <= marriageIndex) bioNotes.push({ spouse_id: null, children_ids: [] })
      if (field === 'spouse_id') { bioNotes[marriageIndex].spouse_id = id }
      else { bioNotes[marriageIndex].spouse_own_partner_id = id }
      await supabase.rpc('upsert_member', { p_member: {
        id: person.id, name: person.name, surname1: person.surname1,
        surname2: person.surname2 ?? '', born: person.born, died: person.died ?? '',
        gender: person.gender, generation: person.generation,
        spouse_id: person.spouse_id ?? '', children_ids: person.children_ids ?? [],
        external: person.external, email: person.email ?? '',
        bio_birthplace: person.bio_birthplace ?? '', bio_education: person.bio_education ?? '',
        bio_occupation: person.bio_occupation ?? '', bio_notes: JSON.stringify(bioNotes)
      }})
    }
    setSaving(false); setOpen(false); onAdd?.(newMember)
  }

  if (open) return (
    <div style={{width:130, borderRadius:10, border:'2px dashed #d97706', background:'#fffbeb', padding:'8px 10px', flexShrink:0}}>
      <div style={{fontSize:10, color:'#92400e', fontWeight:700, marginBottom:6}}>Agregar datos</div>
      {[['Nombre', name, setName],['Apellido', surname1, setSurname1]].map(([l,v,fn]:any) => (
        <input key={l} placeholder={l} value={v} onChange={(e:any)=>fn(e.target.value)}
          style={{width:'100%', fontSize:11, padding:'3px 6px', borderRadius:6, border:'1px solid #fbbf24', marginBottom:4, boxSizing:'border-box' as any}}/>
      ))}
      <input type="date" value={born} onChange={e=>setBorn(e.target.value)}
        style={{width:'100%', fontSize:11, padding:'3px 6px', borderRadius:6, border:'1px solid #fbbf24', marginBottom:4, boxSizing:'border-box' as any}}/>
      <select value={gender} onChange={e=>setGender(e.target.value as 'M'|'F')}
        style={{width:'100%', fontSize:11, padding:'3px 6px', borderRadius:6, border:'1px solid #fbbf24', marginBottom:6, boxSizing:'border-box' as any}}>
        <option value="M">Masculino</option>
        <option value="F">Femenino</option>
      </select>
      <div style={{display:'flex', gap:4}}>
        <button onClick={()=>setOpen(false)} style={{flex:1, fontSize:10, padding:'3px', borderRadius:6, border:'1px solid #e2e8f0', background:'#f1f5f9', cursor:'pointer'}}>✕</button>
        <button onClick={handleSave} disabled={saving} style={{flex:2, fontSize:10, padding:'3px', borderRadius:6, border:'none', background: saving ? '#94a3b8' : '#d97706', color:'#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight:700}}>
          {saving ? '⏳' : 'Guardar'}
        </button>
      </div>
    </div>
  )
  return (
    <div onClick={()=>setOpen(true)} style={{width:80, borderRadius:10, border:'2px dashed #94a3b8', background:'#f8fafc', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px 4px', color:'#94a3b8', fontSize:18, fontWeight:700, flexShrink:0, cursor:'pointer'}}>
      <div>?</div>
      <div style={{fontSize:8, marginTop:1, textAlign:'center'}}>no registrado</div>
      <div style={{fontSize:9, color:'#d97706', marginTop:4}}>✏️ editar</div>
    </div>
  )
}

// ── COLLAPSE CONTEXT ─────────────────────────────────────────────────────────
const CollapseContext = React.createContext<{collapsed:Set<string>, toggle:(id:string)=>void}>({collapsed:new Set(), toggle:()=>{}})

function Kids({list, members, onSelect, political=false, onAddMember}: {
  list:Member[], members:Member[], onSelect:(p:Member)=>void, political?:boolean, onAddMember?:(m:Member)=>void
}) {
  if (!list.length) return null
  const color = political ? POLIT_COLOR : BLOOD_COLOR
  if (list.length === 1) return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
      <VLine h={20} color={color}/>
      <TreeNode person={list[0]} members={members} onSelect={onSelect} onAddMember={onAddMember}/>
    </div>
  )
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
      <VLine h={20} color={color}/>
      <div style={{display:'flex', alignItems:'flex-start'}}>
        {list.map((kid, i) => (
          <div key={kid.id} style={{display:'flex', flexDirection:'column', alignItems:'center', margin:'0 10px'}}>
            <div style={{display:'flex', alignItems:'center', width:'100%'}}>
              <div style={{flex:1, height:3, background: i===0 ? 'transparent' : color}}/>
              <VLine h={20} color={color}/>
              <div style={{flex:1, height:3, background: i===list.length-1 ? 'transparent' : color}}/>
            </div>
            <TreeNode person={kid} members={members} onSelect={onSelect} onAddMember={onAddMember}/>
          </div>
        ))}
      </div>
    </div>
  )
}

function Pair({left, right, kids, members, onSelect, onAddMember}: {
  left:Member, right:Member|null, kids:Member[],
  members:Member[], onSelect:(p:Member)=>void, onAddMember?:(m:Member)=>void
}) {
  const { collapsed, toggle } = React.useContext(CollapseContext)
  const nodeId = left.id + (right?.id ?? '')
  const isCollapsed = collapsed.has(nodeId)
  const hasKids = kids.length > 0
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
      <div style={{display:'flex', alignItems:'center'}}>
        <MiniCard person={left} onSelect={onSelect}
          collapsed={isCollapsed}
          onToggleCollapse={hasKids ? ()=>toggle(nodeId) : undefined}/>
        {right && <>
          <div style={{width:20, height:3, background:MARRY_COLOR, flexShrink:0}}/>
          <MiniCard person={right} onSelect={onSelect}/>
        </>}
      </div>
      {!isCollapsed && <Kids list={kids} members={members} onSelect={onSelect} onAddMember={onAddMember}/>}
    </div>
  )
}

function SpouseWithUnknown({spouse, ownKids, members, onSelect}: {
  spouse:Member, ownKids:Member[], members:Member[], onSelect:(p:Member)=>void
}) {
  if (!ownKids.length) return <MiniCard person={spouse} onSelect={onSelect}/>
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
      <MiniCard person={spouse} onSelect={onSelect}/>
      <VLine h={14} color={POLIT_COLOR}/>
      <div style={{display:'flex', alignItems:'center'}}>
        <div style={{width:20, height:2, borderTop:`2px dashed ${POLIT_COLOR}`}}/>
        <UnknownParent/>
      </div>
      <Kids list={ownKids} members={members} onSelect={onSelect} political={true}/>
    </div>
  )
}

function TreeNode({person, members, onSelect, onAddMember}: {
  person:Member, members:Member[], onSelect:(p:Member)=>void, onAddMember?:(m:Member)=>void
}) {
  const marriages = getMarriages(person, members)
  const { collapsed, toggle } = React.useContext(CollapseContext)

  if (marriages.length === 1) {
    const {spouse, children, spouseOwnChildren} = marriages[0]
    if (spouseOwnChildren.length > 0 && spouse) {
      const spouseIsLeft = spouse.gender === 'M'
      return (
        <div style={{display:'flex', alignItems:'flex-start', gap:0}}>
          {spouseIsLeft ? <>
            <SpouseWithUnknown spouse={spouse} ownKids={spouseOwnChildren} members={members} onSelect={onSelect}/>
            <div style={{width:20, height:3, background:MARRY_COLOR, alignSelf:'flex-start', marginTop:28, flexShrink:0}}/>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
              <MiniCard person={person} onSelect={onSelect}/>
              <Kids list={children} members={members} onSelect={onSelect} onAddMember={onAddMember}/>
            </div>
          </> : <>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
              <MiniCard person={person} onSelect={onSelect}/>
              <Kids list={children} members={members} onSelect={onSelect} onAddMember={onAddMember}/>
            </div>
            <div style={{width:20, height:3, background:MARRY_COLOR, alignSelf:'flex-start', marginTop:28, flexShrink:0}}/>
            <SpouseWithUnknown spouse={spouse} ownKids={spouseOwnChildren} members={members} onSelect={onSelect}/>
          </>}
        </div>
      )
    }
    const left  = !spouse || person.gender === 'M' ? person : spouse
    const right = (left === person ? spouse : person) ?? null
    return <Pair left={left} right={right} kids={children} members={members} onSelect={onSelect} onAddMember={onAddMember}/>
  }

  // ── MULTIPLE MARRIAGES ──────────────────────────────────────────────────
  const prev = marriages[0]
  const curr = marriages[marriages.length - 1]
  const currSpouseOtherParent = curr.spouseOwnChildren.length > 0 && curr.spouse
    ? members.find(m => m.id !== curr.spouse!.id && curr.spouseOwnChildren.every(c => m.children_ids?.includes(c.id))) ?? null
    : null
  const GhostCard = () => (
    <div style={{position:'relative', opacity:0.45, cursor:'pointer'}} onClick={()=>onSelect(person)}>
      <MiniCard person={person} onSelect={onSelect}/>
      <div style={{position:'absolute', bottom:-10, left:'50%', transform:'translateX(-50%)', background:'#475569', color:'#fff', fontSize:9, fontWeight:700, borderRadius:10, padding:'2px 6px', whiteSpace:'nowrap'}}>= misma</div>
    </div>
  )

  return (
    <div style={{display:'flex', alignItems:'flex-start', gap:24}}>
      {prev.spouseOwnChildren.length > 0 && prev.spouse && (()=>{
        let bioNotes: any[] = []
        try { bioNotes = JSON.parse(person.bio_notes ?? '[]') } catch {}
        const prevMarriage = bioNotes[0]
        const ownPartner = prevMarriage?.spouse_own_partner_id
          ? members.find(m => m.id === prevMarriage.spouse_own_partner_id) ?? null
          : null
        return (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
            <div style={{display:'flex', alignItems:'center'}}>
              {ownPartner
                ? <MiniCard person={ownPartner} onSelect={onSelect}/>
                : <UnknownParent onAdd={onAddMember} patchContext={{person, marriageIndex:0, field:'spouse_own_children_ids'}}/>
              }
              <div style={{width:20, height:3, background:MARRY_COLOR, flexShrink:0}}/>
              <div style={{position:'relative', opacity:0.45, cursor:'pointer'}} onClick={()=>onSelect(prev.spouse!)}>
                <MiniCard person={prev.spouse} onSelect={onSelect}/>
                <div style={{position:'absolute', bottom:-10, left:'50%', transform:'translateX(-50%)', background:'#475569', color:'#fff', fontSize:9, fontWeight:700, borderRadius:10, padding:'2px 6px', whiteSpace:'nowrap'}}>= misma</div>
              </div>
            </div>
            <Kids list={prev.spouseOwnChildren} members={members} onSelect={onSelect} onAddMember={onAddMember} political={true}/>
          </div>
        )
      })()}

      <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center'}}>
          {prev.spouse
            ? <MiniCard person={prev.spouse} onSelect={onSelect}/>
            : <UnknownParent onAdd={onAddMember} patchContext={{person, marriageIndex:0, field:'spouse_id'}}/>
          }
          <div style={{width:20, height:3, background:MARRY_COLOR, flexShrink:0}}/>
          <MiniCard person={person} onSelect={onSelect}/>
        </div>
        <Kids list={prev.children} members={members} onSelect={onSelect} onAddMember={onAddMember}/>
      </div>

      {(curr.spouse || curr.children.length > 0) && (
        <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
          <div style={{display:'flex', alignItems:'center'}}>
            <GhostCard/>
            <div style={{width:20, height:3, background:MARRY_COLOR, flexShrink:0}}/>
            {curr.spouse
              ? <MiniCard person={curr.spouse} onSelect={onSelect}/>
              : <UnknownParent onAdd={onAddMember} patchContext={{person, marriageIndex:marriages.length-1, field:'spouse_id'}}/>
            }
          </div>
          <Kids list={curr.children} members={members} onSelect={onSelect} onAddMember={onAddMember}/>
        </div>
      )}

      {curr.spouseOwnChildren.length > 0 && curr.spouse && (
        <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
          <div style={{display:'flex', alignItems:'center'}}>
            <MiniCard person={curr.spouse} onSelect={onSelect}/>
            <div style={{width:20, height:3, background:MARRY_COLOR, flexShrink:0}}/>
            {currSpouseOtherParent
              ? <MiniCard person={currSpouseOtherParent} onSelect={onSelect}/>
              : <UnknownParent onAdd={onAddMember}/>
            }
          </div>
          <Kids list={curr.spouseOwnChildren} members={members} onSelect={onSelect} onAddMember={onAddMember}/>
        </div>
      )}
    </div>
  )
}

function BirthdayView({members,onSelect}:{members:Member[];onSelect:(p:Member)=>void}){
  const [sortBy,setSortBy]=useState<'date'|'name'>('date')
  const today=new Date()
  const todayMD=`${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const alive=members.filter(m=>!m.died)
  const sorted=[...alive].sort((a,b)=>sortBy==='name'?a.name.localeCompare(b.name,'es'):a.born.slice(5).localeCompare(b.born.slice(5)))
  const upcoming=sorted.filter(m=>m.born.slice(5)>=todayMD).slice(0,3)
  return (
    <div>
      {upcoming.length>0&&<div style={{background:'linear-gradient(135deg,#7c3aed,#db2777)',borderRadius:14,padding:16,marginBottom:20,color:'#fff'}}>
        <div style={{fontSize:12,fontWeight:700,opacity:0.8,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>🎂 Próximos cumpleaños</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {upcoming.map(p=><div key={p.id} onClick={()=>onSelect(p)} style={{background:'rgba(255,255,255,0.15)',borderRadius:10,padding:'8px 12px',cursor:'pointer'}}>
            <div style={{fontWeight:700,fontSize:13}}>{p.name} {p.surname1}</div>
            <div style={{fontSize:11,opacity:0.85}}>{p.born.slice(8)}/{p.born.slice(5,7)} · {calcAge(p.born,null)} años</div>
          </div>)}
        </div>
      </div>}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {(['date','name'] as const).map(s=><button key={s} onClick={()=>setSortBy(s)} style={{padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',background:sortBy===s?'#1e293b':'#f1f5f9',color:sortBy===s?'#fff':'#64748b',fontWeight:600,fontSize:12}}>{s==='date'?'📅 Por fecha':'🔤 Por nombre'}</button>)}
      </div>
      {sortBy==='date'?monthNames.map((mn,mi)=>{
        const inMonth=sorted.filter(m=>parseInt(m.born.slice(5,7))===mi+1)
        if(!inMonth.length)return null
        return <div key={mi} style={{marginBottom:18}}>
          <div style={{fontSize:12,fontWeight:800,color:'#7c3aed',textTransform:'uppercase',letterSpacing:2,marginBottom:8,borderBottom:'2px solid #ede9fe',paddingBottom:4}}>{mn}</div>
          {inMonth.map(p=><BdayRow key={p.id} person={p} onSelect={onSelect}/>)}
        </div>
      }):<div>{sorted.map(p=><BdayRow key={p.id} person={p} onSelect={onSelect}/>)}</div>}
    </div>
  )
}

function BdayRow({person,onSelect}:{person:Member;onSelect:(p:Member)=>void}){
  const t=new Date()
  const isBDay=parseInt(person.born.slice(5,7))===t.getMonth()+1&&parseInt(person.born.slice(8))===t.getDate()
  return <div onClick={()=>onSelect(person)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:isBDay?'#fef9c3':'#f8fafc',borderRadius:10,cursor:'pointer',border:isBDay?'2px solid #fbbf24':'2px solid transparent',marginBottom:6}}>
    <Avatar p={person} size={34}/>
    <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{fullName(person)}</div><div style={{fontSize:11,color:'#64748b'}}>Gen {person.generation}</div></div>
    <div style={{textAlign:'right'}}><div style={{fontSize:13,fontWeight:700,color:'#7c3aed'}}>{person.born.slice(8)}/{person.born.slice(5,7)}</div><div style={{fontSize:11,color:'#94a3b8'}}>{calcAge(person.born,null)} años</div></div>
    {isBDay&&<span>🎂</span>}
  </div>
}

function ListView({members,onSelect}:{members:Member[];onSelect:(p:Member)=>void}){
  const [filter,setFilter]=useState('all')
  const [search,setSearch]=useState('')
  const filtered=members.filter(m=>{
    if(filter==='living')return!m.died
    if(filter==='deceased')return!!m.died
    if(filter.startsWith('gen'))return m.generation===parseInt(filter[3])
    return true
  }).filter(m=>!search||fullName(m).toLowerCase().includes(search.toLowerCase()))
  return (
    <div>
      <input placeholder="🔍 Buscar por nombre…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'2px solid #e2e8f0',fontSize:14,marginBottom:12,outline:'none',boxSizing:'border-box'}}/>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
        {[['all','Todos'],['living','Vivos'],['deceased','Fallecidos'],['gen1','1ª Gen'],['gen2','2ª Gen'],['gen3','3ª Gen'],['gen4','4ª Gen']].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} style={{padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',background:filter===v?'#1e293b':'#f1f5f9',color:filter===v?'#fff':'#64748b',fontWeight:600,fontSize:12}}>{l}</button>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
        {filtered.map(p=><div key={p.id} onClick={()=>onSelect(p)} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'#f8fafc',borderRadius:12,cursor:'pointer',border:'2px solid #e2e8f0',transition:'all 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#7c3aed';e.currentTarget.style.background='#faf5ff'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.background='#f8fafc'}}>
          <Avatar p={p} size={38}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{fullName(p)}</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{fmtDate(p.born)}{p.died?` — ${fmtDate(p.died)}`:''} · Gen {p.generation}</div>
          </div>
          {p.died&&<span style={{fontSize:13,opacity:0.5}}>†</span>}
        </div>)}
      </div>
    </div>
  )
}

function StatsView({members}:{members:Member[]}){
  const alive=members.filter(m=>!m.died)
  const avgAge=alive.length?Math.round(alive.reduce((s,m)=>s+calcAge(m.born,null),0)/alive.length):0
  const oldest=[...alive].sort((a,b)=>a.born.localeCompare(b.born))[0]
  const youngest=[...alive].sort((a,b)=>b.born.localeCompare(a.born))[0]
  const gens=[1,2,3,4].map(g=>({g,count:members.filter(m=>m.generation===g).length}))
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:20}}>
        {[{l:'Total',v:members.length,i:'👨‍👩‍👧‍👦',bg:'#eff6ff',c:'#2563eb'},{l:'Vivos',v:alive.length,i:'💚',bg:'#f0fdf4',c:'#16a34a'},{l:'Fallecidos',v:members.filter(m=>m.died).length,i:'🕊️',bg:'#f8fafc',c:'#64748b'},{l:'Edad promedio',v:`${avgAge} años`,i:'🎂',bg:'#faf5ff',c:'#7c3aed'},{l:'Generaciones',v:4,i:'🌳',bg:'#fff7ed',c:'#ea580c'}].map(s=>(
          <div key={s.l} style={{background:s.bg,borderRadius:14,padding:'14px 12px',textAlign:'center'}}>
            <div style={{fontSize:24}}>{s.i}</div>
            <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
            <div style={{fontSize:11,color:'#64748b',fontWeight:600,marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div style={{background:'#f8fafc',borderRadius:14,padding:16}}>
          <div style={{fontSize:11,fontWeight:800,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Por generación</div>
          {gens.map(({g,count})=><div key={g} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}><span style={{fontWeight:600}}>Generación {g}</span><span style={{color:'#7c3aed',fontWeight:700}}>{count}</span></div>
            <div style={{background:'#e2e8f0',borderRadius:4,height:8,overflow:'hidden'}}><div style={{width:`${members.length?(count/members.length)*100:0}%`,height:'100%',background:'#7c3aed',borderRadius:4}}/></div>
          </div>)}
        </div>
        <div style={{background:'#f8fafc',borderRadius:14,padding:16}}>
          <div style={{fontSize:11,fontWeight:800,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Destacados</div>
          {oldest&&<SI i="👴" l="El mayor" v={`${oldest.name} · ${calcAge(oldest.born,null)} años`}/>}
          {youngest&&<SI i="👶" l="El menor" v={`${youngest.name} · ${calcAge(youngest.born,null)} años`}/>}
          <SI i="♂️" l="Hombres" v={`${members.filter(m=>m.gender==='M').length}`}/>
          <SI i="♀️" l="Mujeres" v={`${members.filter(m=>m.gender==='F').length}`}/>
        </div>
      </div>
    </div>
  )
}

function SI({i,l,v}:{i:string;l:string;v:string}){
  return <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:10}}><span style={{fontSize:18}}>{i}</span><div><div style={{fontSize:11,color:'#94a3b8',fontWeight:600}}>{l}</div><div style={{fontSize:13,fontWeight:700}}>{v}</div></div></div>
}

function EditModal({person,isAdmin,onClose,onSubmit}:{person:Member;isAdmin:boolean;onClose:()=>void;onSubmit:(p:Member,note:string)=>void}){
  const [form,setForm]=useState({...person})
  const [note,setNote]=useState('')
  const set=(k:keyof Member,v:any)=>setForm(f=>({...f,[k]:v}))
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:440,width:'100%',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:17}}>{isAdmin?'✏️ Editar':'📝 Proponer cambio'}</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#64748b'}}>×</button>
        </div>
        {!isAdmin&&<div style={{background:'#fef3c7',border:'1px solid #fbbf24',borderRadius:8,padding:'10px 12px',fontSize:13,color:'#92400e',marginBottom:14}}>⚠️ Tu propuesta será revisada por un administrador.</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          {([['name','Nombre'],['surname1','Primer apellido'],['surname2','Segundo apellido'],['email','Email'],['bio_birthplace','Lugar de nacimiento'],['bio_occupation','Ocupación'],['bio_education','Educación']] as [keyof Member,string][]).map(([k,l])=>(
            <label key={k} style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600,gridColumn:k==='name'?'1 / -1':undefined}}>
              {l}<input value={(form[k]??'') as string} onChange={e=>set(k,e.target.value||null)} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none'}}/>
            </label>
          ))}
          {([['born','Nacimiento'],['died','Fallecimiento (si aplica)']] as [keyof Member,string][]).map(([k,l])=>(
            <label key={k} style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600}}>
              {l}<input type="date" value={(form[k]??'') as string} onChange={e=>set(k,e.target.value||null)} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none'}}/>
            </label>
          ))}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600,gridColumn:'1 / -1'}}>
            Nota biográfica
            <textarea value={(form.bio_notes??'') as string} onChange={e=>set('bio_notes',e.target.value||null)} rows={2} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none',resize:'vertical'}}/>
          </label>
        </div>
        {!isAdmin&&<label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600,marginBottom:12}}>
          Motivo del cambio
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none',resize:'vertical'}}/>
        </label>}
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'10px',background:'#f1f5f9',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Cancelar</button>
          <button onClick={()=>onSubmit(form,note)} style={{flex:2,padding:'10px',background:'#1e293b',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>{isAdmin?'💾 Guardar':'📤 Enviar'}</button>
        </div>
      </div>
    </div>
  )
}

function PendingView({pending,members,onApprove,onReject,onEdit}:{pending:PendingEdit[];members:Member[];onApprove:(id:string)=>void;onReject:(id:string)=>void;onEdit:(m:Member)=>void}){
  if(!pending.length)return<div style={{textAlign:'center',padding:60,color:'#94a3b8'}}><div style={{fontSize:40}}>✅</div><div style={{marginTop:12,fontWeight:600}}>No hay cambios pendientes</div></div>
  return<div style={{display:'flex',flexDirection:'column',gap:12}}>
    {pending.map(e=>{
      const member = members.find(m=>m.id===e.member_id)
      return <div key={e.id} style={{background:'#fffbeb',border:'2px solid #fbbf24',borderRadius:14,padding:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
          <div style={{fontWeight:700,fontSize:14}}>Propuesto por: {e.proposed_by}</div>
          {member&&<button onClick={()=>onEdit(member)} style={{padding:'4px 10px',background:'#1e293b',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700,flexShrink:0}}>✏️ Editar ficha</button>}
        </div>
        {e.note&&<div style={{fontSize:12,color:'#92400e',marginBottom:10,background:'#fef3c7',borderRadius:6,padding:'6px 10px'}}>💬 {e.note}</div>}
        <div style={{fontSize:12,color:'#64748b',marginBottom:12}}>{Object.entries(e.changes).map(([k,v])=><div key={k}>• <b>{k}</b>: {String(v)}</div>)}</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>onApprove(e.id)} style={{padding:'8px 16px',background:'#16a34a',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12}}>✓ Aprobar</button>
          <button onClick={()=>onReject(e.id)} style={{padding:'8px 16px',background:'#dc2626',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12}}>✕ Rechazar</button>
        </div>
      </div>
    })}
  </div>
}

function AdminPanel({ onChangePassword, onImportExcel, onAddMember, importing, members, isSuper, adminUser }: {
  onChangePassword: (oldPass: string, newPass: string) => void
  onImportExcel: (file: File) => void
  onAddMember: () => void
  importing: boolean
  members: Member[]
  isSuper: boolean
  adminUser: {username:string,role:string,branch:string|null}|null
}) {
  const [tab, setTab] = useState<'tools'|'password'|'admins'>('tools')
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState('')
  const [admins, setAdmins] = useState<any[]>([])
  const [newAdmin, setNewAdmin] = useState({username:'',password:'',role:'family',family_branch:''})
  const fileRef = useRef<HTMLInputElement>(null)

  const loadAdmins = async () => {
    const {data} = await supabase.from('admins').select('id,username,role,family_branch,created_at').order('created_at')
    if (data) setAdmins(data)
  }

  useEffect(()=>{ if(tab==='admins') loadAdmins() },[tab])

  const handleChangePass = () => {
    if (newPass !== newPass2) { setPassError('Las contraseñas no coinciden'); setPassSuccess(''); return }
    if (newPass.length < 6) { setPassError('Mínimo 6 caracteres'); setPassSuccess(''); return }
    setPassError(''); setPassSuccess('')
    onChangePassword(oldPass, newPass)
    setOldPass(''); setNewPass(''); setNewPass2('')
    setPassSuccess('✅ Contraseña actualizada')
  }

  const handleAddAdmin = async () => {
    if (!newAdmin.username || !newAdmin.password) return
    await supabase.rpc('create_admin', {
      p_username: newAdmin.username,
      p_password: newAdmin.password,
      p_role: newAdmin.role,
      p_branch: newAdmin.family_branch || null
    })
    setNewAdmin({username:'',password:'',role:'family',family_branch:''})
    loadAdmins()
  }

  const handleDeleteAdmin = async (id:string) => {
    await supabase.from('admins').delete().eq('id',id)
    loadAdmins()
  }

  const handleDownload = async () => {
    const XLSX = await import('xlsx')
    const rows = members.map(m => ({
      id: m.id, name: m.name, surname1: m.surname1, surname2: m.surname2,
      born: m.born, died: m.died ?? '', gender: m.gender, generation: m.generation,
      spouse_id: m.spouse_id ?? '', children_ids: (m.children_ids ?? []).join(','),
      external: m.external ? 'true' : 'false', email: m.email ?? '',
      bio_birthplace: m.bio_birthplace ?? '', bio_education: m.bio_education ?? '',
      bio_occupation: m.bio_occupation ?? '', bio_notes: m.bio_notes ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{wch:12},{wch:14},{wch:16},{wch:16},{wch:12},{wch:12},{wch:8},{wch:10},{wch:14},{wch:30},{wch:8},{wch:22},{wch:20},{wch:20},{wch:20},{wch:40}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Miembros')
    XLSX.writeFile(wb, 'arbol_familiar.xlsx')
  }

  return (
    <div style={{background:'#f8fafc',borderRadius:14,padding:20,marginBottom:20,border:'2px solid #e2e8f0'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <span style={{fontSize:20}}>👑</span>
        <div style={{fontWeight:800,fontSize:16,color:'#1e293b'}}>Panel de Administrador</div>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {([['tools','🛠️ Herramientas'],['password','🔑 Contraseña'],...(isSuper?[['admins','👥 Admins']]:[])] as [string,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t as any)} style={{padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',background:tab===t?'#1e293b':'#e2e8f0',color:tab===t?'#fff':'#64748b',fontWeight:600,fontSize:12}}>{l}</button>
        ))}
      </div>
      {tab==='tools'&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <button onClick={onAddMember} style={{padding:'12px 16px',background:'#16a34a',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:14,textAlign:'left'}}>➕ Agregar nueva persona</button>
          <button onClick={handleDownload} style={{padding:'12px 16px',background:'#0369a1',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:14,textAlign:'left'}}>📥 Descargar datos Excel</button>
          <div style={{background:'#fff',borderRadius:10,padding:14,border:'2px dashed #cbd5e1'}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>📊 Cargar datos desde Excel</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:10}}>Sube el archivo Excel con los datos de tu familia.</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&onImportExcel(e.target.files[0])}/>
            <button onClick={()=>fileRef.current?.click()} disabled={importing} style={{padding:'10px 20px',background:importing?'#94a3b8':'#2563eb',color:'#fff',border:'none',borderRadius:8,cursor:importing?'not-allowed':'pointer',fontWeight:700,fontSize:13}}>
              {importing?'⏳ Importando...':'📁 Seleccionar archivo Excel'}
            </button>
          </div>
        </div>
      )}
      {tab==='password'&&(
        <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:320}}>
          <div style={{fontSize:13,color:'#64748b',marginBottom:4}}>Cambia tu contraseña.</div>
          {[['Contraseña actual',oldPass,setOldPass],['Nueva contraseña',newPass,setNewPass],['Confirmar nueva contraseña',newPass2,setNewPass2]].map(([l,v,fn])=>(
            <label key={l as string} style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600}}>
              {l as string}
              <input type="password" value={v as string} onChange={e=>(fn as any)(e.target.value)} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none'}}/>
            </label>
          ))}
          {passError&&<div style={{fontSize:12,color:'#dc2626'}}>{passError}</div>}
          {passSuccess&&<div style={{fontSize:12,color:'#16a34a'}}>{passSuccess}</div>}
          <button onClick={handleChangePass} style={{padding:'10px',background:'#1e293b',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,marginTop:4}}>💾 Cambiar contraseña</button>
        </div>
      )}
      {tab==='admins'&&isSuper&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1e293b',marginBottom:4}}>Administradores activos</div>
          {admins.map(a=>(
            <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,background:'#fff',borderRadius:10,padding:'10px 14px',border:'1px solid #e2e8f0'}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>{a.username}</div>
                <div style={{fontSize:11,color:'#94a3b8'}}>{a.role==='super'?'Super admin':'Admin familia'}{a.family_branch?` · ${a.family_branch}`:''}</div>
              </div>
              {a.username!==adminUser?.username&&<button onClick={()=>handleDeleteAdmin(a.id)} style={{padding:'4px 10px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>Eliminar</button>}
            </div>
          ))}
          <div style={{borderTop:'1px solid #e2e8f0',paddingTop:12,marginTop:4}}>
            <div style={{fontSize:13,fontWeight:700,color:'#1e293b',marginBottom:8}}>Agregar administrador</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[['Usuario',newAdmin.username,'username'],['Contraseña',newAdmin.password,'password']].map(([l,v,k])=>(
                <label key={k} style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600}}>
                  {l}<input type={k==='password'?'password':'text'} value={v} onChange={e=>setNewAdmin(n=>({...n,[k]:e.target.value}))} style={{padding:'8px 10px',borderRadius:8,border:'1px solid #e2e8f0',fontSize:12,outline:'none'}}/>
                </label>
              ))}
              <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600}}>
                Rol
                <select value={newAdmin.role} onChange={e=>setNewAdmin(n=>({...n,role:e.target.value}))} style={{padding:'8px 10px',borderRadius:8,border:'1px solid #e2e8f0',fontSize:12,outline:'none'}}>
                  <option value="family">Admin familia</option>
                  <option value="super">Super admin</option>
                </select>
              </label>
              <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600}}>
                Rama (id miembro)
                <input value={newAdmin.family_branch} onChange={e=>setNewAdmin(n=>({...n,family_branch:e.target.value}))} placeholder="ej: g2m1" style={{padding:'8px 10px',borderRadius:8,border:'1px solid #e2e8f0',fontSize:12,outline:'none'}}/>
              </label>
            </div>
            <button onClick={handleAddAdmin} style={{marginTop:10,width:'100%',padding:'10px',background:'#1e293b',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>➕ Agregar admin</button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewMemberModal({onClose,onSave}:{onClose:()=>void;onSave:(m:Member)=>void}){
  const [form,setForm]=useState<Partial<Member>>({gender:'M',generation:3,external:false,children_ids:[]})
  const set=(k:keyof Member,v:any)=>setForm(f=>({...f,[k]:v}))
  const handleSave=()=>{
    if(!form.name||!form.surname1||!form.surname2||!form.born||!form.generation){alert('Completa los campos obligatorios');return}
    const id=`m${Date.now()}`
    onSave({...form,id,children_ids:form.children_ids||[],external:form.external||false,email:form.email||null,bio_birthplace:form.bio_birthplace||null,bio_education:form.bio_education||null,bio_occupation:form.bio_occupation||null,bio_notes:form.bio_notes||null,died:form.died||null,spouse_id:form.spouse_id||null} as Member)
  }
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:17}}>➕ Nueva persona</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#64748b'}}>×</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          {([['name','Nombre *'],['surname1','Primer apellido *'],['surname2','Segundo apellido *'],['email','Email'],['bio_birthplace','Lugar de nacimiento'],['bio_occupation','Ocupación'],['bio_education','Educación'],['spouse_id','ID Cónyuge']] as [keyof Member,string][]).map(([k,l])=>(
            <label key={k} style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600,gridColumn:k==='name'?'1 / -1':undefined}}>
              {l}<input value={(form[k]??'') as string} onChange={e=>set(k,e.target.value||null)} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none'}}/>
            </label>
          ))}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600}}>
            Nacimiento *<input type="date" value={(form.born??'') as string} onChange={e=>set('born',e.target.value||null)} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600}}>
            Fallecimiento<input type="date" value={(form.died??'') as string} onChange={e=>set('died',e.target.value||null)} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600}}>
            Género *
            <select value={form.gender??'M'} onChange={e=>set('gender',e.target.value)} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none'}}>
              <option value="M">Masculino</option><option value="F">Femenino</option>
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600}}>
            Generación *
            <select value={form.generation??3} onChange={e=>set('generation',parseInt(e.target.value))} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none'}}>
              <option value={1}>1ª - Abuelos</option><option value={2}>2ª - Padres</option>
              <option value={3}>3ª - Hijos</option><option value={4}>4ª - Nietos</option>
            </select>
          </label>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#64748b',fontWeight:600,gridColumn:'1 / -1'}}>
            <input type="checkbox" checked={form.external||false} onChange={e=>set('external',e.target.checked)}/> Ingresó por matrimonio
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600,gridColumn:'1 / -1'}}>
            Nota biográfica
            <textarea value={(form.bio_notes??'') as string} onChange={e=>set('bio_notes',e.target.value||null)} rows={2} style={{padding:'8px 10px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:13,outline:'none',resize:'vertical'}}/>
          </label>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'10px',background:'#f1f5f9',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Cancelar</button>
          <button onClick={handleSave} style={{flex:2,padding:'10px',background:'#16a34a',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>💾 Guardar persona</button>
        </div>
      </div>
    </div>
  )
}

// ─── VISTA RAMAS: muestra cada hijo G2 con su familia en vertical ───────────

function BranchCard({ person, onSelect, highlight=false }: { person: Member; onSelect:(p:Member)=>void; highlight?:boolean }) {
  const bg = person.gender==='M' ? '#dbeafe' : '#fce7f3'
  const border = highlight ? '#d97706' : (person.external ? '#94a3b8' : '#d97706')
  const borderStyle = person.external ? 'dashed' : 'solid'
  return (
    <div onClick={()=>onSelect(person)} style={{background: person.external ? '#f8fafc' : bg, border:`2px ${borderStyle} ${border}`,borderRadius:12,padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,minWidth:160,maxWidth:220,opacity:person.died?0.75:1,boxShadow:highlight?'0 2px 10px rgba(217,119,6,0.3)':'0 1px 4px rgba(0,0,0,0.06)',transition:'transform 0.15s'}}
      onMouseEnter={e=>(e.currentTarget.style.transform='translateY(-2px)')}
      onMouseLeave={e=>(e.currentTarget.style.transform='')}>
      <Avatar p={person} size={36}/>
      <div style={{minWidth:0}}>
        <div style={{fontSize:12,fontWeight:700,color:'#1e293b',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{person.name} {person.surname1}</div>
        <div style={{fontSize:10,color:'#64748b',marginTop:1}}>{person.born?.slice(0,4)}{person.died?`–${person.died.slice(0,4)}`:''}</div>
        {person.died&&<div style={{fontSize:10,color:'#94a3b8'}}>† In Memoriam</div>}
      </div>
    </div>
  )
}

function BranchSection({ person, members, onSelect, depth=0 }: { person:Member; members:Member[]; onSelect:(p:Member)=>void; depth?:number }) {
  const [open, setOpen] = React.useState(true)

  let prevMarriages: Array<{spouse_id:string|null,children_ids:string[]}> = []
  if (person.bio_notes) {
    try { const p=JSON.parse(person.bio_notes); if(Array.isArray(p)) prevMarriages=p } catch {}
  }

  const allMarriages = getMarriages(person, members)
  const totalChildren = allMarriages.reduce((s,m)=>s+m.children.length,0)

  const indentLeft = depth * 24

  return (
    <div style={{marginBottom: depth===0?0:0}}>
      {/* Cabecera: persona + cónyuge(s) */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:indentLeft,flexWrap:'wrap'}}>
        <BranchCard person={person} onSelect={onSelect} highlight={!person.external}/>
        {allMarriages.map((m,i)=>m.spouse&&(
          <React.Fragment key={i}>
            <div style={{color:'#d97706',fontWeight:900,fontSize:16}}>⚭</div>
            <BranchCard person={m.spouse} onSelect={onSelect}/>
          </React.Fragment>
        ))}
        {totalChildren>0&&(
          <button onClick={()=>setOpen(o=>!o)} style={{padding:'3px 8px',borderRadius:20,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,color:'#64748b',flexShrink:0}}>
            {open?'▲':'▼'} {totalChildren} {totalChildren===1?'hijo':'hijos'}
          </button>
        )}
      </div>

      {/* Línea vertical + hijos */}
      {open && totalChildren>0 && (
        <div style={{marginLeft:indentLeft+20,marginTop:6,borderLeft:'2px solid #fcd34d',paddingLeft:16,display:'flex',flexDirection:'column',gap:8}}>
          {allMarriages.map((marriage,mi)=>
            marriage.children.map(child=>(
              <div key={child.id} style={{position:'relative'}}>
                {/* Tick horizontal */}
                <div style={{position:'absolute',left:-18,top:22,width:18,height:2,background:'#fcd34d'}}/>
                <BranchSection person={child} members={members} onSelect={onSelect} depth={0}/>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function BranchView({ members, onSelect }: { members:Member[]; onSelect:(p:Member)=>void }) {
  const g1 = members.filter(m=>m.generation===1&&!m.external)
  const g2roots = members.filter(m=>m.generation===2&&!m.external)
  // Ordenar por fecha de nacimiento
  const sorted = [...g2roots].sort((a,b)=>a.born.localeCompare(b.born))

  return (
    <div>
      <div style={{background:'linear-gradient(135deg,#1e293b,#334155)',borderRadius:14,padding:'14px 18px',marginBottom:20,color:'#fff'}}>
        <div style={{fontSize:14,fontWeight:800}}>🌿 Vista por Ramas Familiares</div>
        <div style={{fontSize:12,opacity:0.75,marginTop:3}}>Cada hijo de la 2ª generación con su familia desplegada verticalmente</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:24}}>
        {sorted.map(person=>(
          <div key={person.id} style={{background:'#fff',borderRadius:16,padding:20,boxShadow:'0 2px 12px rgba(0,0,0,0.06)',border:'1px solid #e2e8f0'}}>
            <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>
              Rama de {person.name} {person.surname1}
            </div>
            <BranchSection person={person} members={members} onSelect={onSelect}/>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── VISTA ÁRBOL INDIVIDUAL: subárbol de cualquier persona G2/G3 ─────────────

function MiniTreeNode({ person, members, onSelect, depth=0 }: { person:Member; members:Member[]; onSelect:(p:Member)=>void; depth?:number }) {
  const [open, setOpen] = React.useState(true)
  const marriages = getMarriages(person, members)
  const totalChildren = marriages.reduce((s,m)=>s+m.children.length,0)

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
      {/* Fila: persona + parejas */}
      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:totalChildren&&open?0:0}}>
        <BranchCard person={person} onSelect={onSelect} highlight={!person.external}/>
        {marriages.map((m,i)=>m.spouse&&(
          <React.Fragment key={i}>
            <div style={{color:'#d97706',fontWeight:900,fontSize:15}}>⚭</div>
            <BranchCard person={m.spouse} onSelect={onSelect}/>
          </React.Fragment>
        ))}
        {totalChildren>0&&(
          <button onClick={()=>setOpen(o=>!o)} style={{padding:'3px 8px',borderRadius:20,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,color:'#64748b'}}>
            {open?'▲':'▼'}
          </button>
        )}
      </div>

      {/* Hijos anidados */}
      {open && totalChildren>0 && (
        <div style={{marginLeft:28,marginTop:6,borderLeft:'2px solid #fcd34d',paddingLeft:14,display:'flex',flexDirection:'column',gap:10}}>
          {marriages.map((marriage,mi)=>
            marriage.children.map(child=>(
              <div key={child.id} style={{position:'relative'}}>
                <div style={{position:'absolute',left:-16,top:22,width:16,height:2,background:'#fcd34d'}}/>
                <MiniTreeNode person={child} members={members} onSelect={onSelect} depth={depth+1}/>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function FocusTreeView({ members, onSelect }: { members:Member[]; onSelect:(p:Member)=>void }) {
  const candidates = members.filter(m=>(m.generation===2||m.generation===3)&&!m.external)
  const sorted = [...candidates].sort((a,b)=>a.generation-b.generation||a.born.localeCompare(b.born))
  const [focusId, setFocusId] = React.useState<string>(sorted[0]?.id??'')
  const focused = members.find(m=>m.id===focusId)

  return (
    <div>
      <div style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)',borderRadius:14,padding:'14px 18px',marginBottom:20,color:'#fff'}}>
        <div style={{fontSize:14,fontWeight:800}}>🔍 Árbol Individual</div>
        <div style={{fontSize:12,opacity:0.75,marginTop:3}}>Visualiza el subárbol de cualquier miembro de la 2ª o 3ª generación</div>
      </div>

      {/* Selector */}
      <div style={{marginBottom:20}}>
        <label style={{fontSize:12,fontWeight:700,color:'#64748b',display:'block',marginBottom:6}}>Seleccionar persona:</label>
        <select value={focusId} onChange={e=>setFocusId(e.target.value)}
          style={{padding:'10px 14px',borderRadius:10,border:'2px solid #e2e8f0',fontSize:13,fontWeight:600,color:'#1e293b',background:'#fff',outline:'none',width:'100%',maxWidth:360,cursor:'pointer'}}>
          {[2,3].map(gen=>(
            <optgroup key={gen} label={`— Generación ${gen} —`}>
              {sorted.filter(m=>m.generation===gen).map(m=>(
                <option key={m.id} value={m.id}>{m.name} {m.surname1} {m.surname2}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Subárbol */}
      {focused && (
        <div style={{background:'#fff',borderRadius:16,padding:24,boxShadow:'0 2px 12px rgba(0,0,0,0.06)',border:'1px solid #e2e8f0',overflowX:'auto'}}>
          <div style={{fontSize:11,fontWeight:800,color:'#7c3aed',textTransform:'uppercase',letterSpacing:2,marginBottom:16}}>
            Árbol de {focused.name} {focused.surname1} {focused.surname2}
            <span style={{marginLeft:8,background:'#ede9fe',color:'#7c3aed',borderRadius:20,padding:'2px 10px',fontSize:10,fontWeight:700}}>Gen {focused.generation}</span>
          </div>
          <MiniTreeNode person={focused} members={members} onSelect={onSelect}/>
        </div>
      )}
    </div>
  )
}

function memberToRpc(m: Member) {
  return {
    id: m.id, name: m.name, surname1: m.surname1, surname2: m.surname2 ?? '',
    born: m.born, died: m.died ?? '', gender: m.gender,
    generation: m.generation, spouse_id: m.spouse_id ?? '',
    children_ids: m.children_ids ?? [], external: m.external, email: m.email ?? '',
    bio_birthplace: m.bio_birthplace ?? '', bio_education: m.bio_education ?? '',
    bio_occupation: m.bio_occupation ?? '', bio_notes: m.bio_notes ?? ''
  }
}

// Need React import for createContext
import React from 'react'

export default function Home() {
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<PendingEdit[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'tree'|'branches'|'focus'|'list'|'birthdays'|'stats'|'admin'|'pending'>('tree')
  const [selected, setSelected] = useState<Member|null>(null)
  const [editTarget, setEditTarget] = useState<Member|null>(null)
  const [showNewMember, setShowNewMember] = useState(false)
  const [adminUser, setAdminUser] = useState<{username:string,role:string,branch:string|null}|null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null)
  const [usingDemo, setUsingDemo] = useState(false)
  const [importing, setImporting] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [bdayPopup, setBdayPopup] = useState<Member[]>([])
  const [showBdayPopup, setShowBdayPopup] = useState(false)
  // Pinch-to-zoom state
  const [scale, setScale] = useState(1)
  const treeRef = useRef<HTMLDivElement>(null)
  const treeInnerRef = useRef<HTMLDivElement>(null)

  // Center tree on load - use getBoundingClientRect for accurate visual position
  useEffect(()=>{
    if (!members.length) return
    setTimeout(() => {
      if (!treeInnerRef.current || !treeRef.current) return
      const outer = treeRef.current
      const inner = treeInnerRef.current
      const gen1Node = inner.querySelector('[data-gen="1"]') as HTMLElement
      if (gen1Node) {
        const outerRect = outer.getBoundingClientRect()
        const nodeRect = gen1Node.getBoundingClientRect()
        const nodeCenter = outer.scrollLeft + (nodeRect.left - outerRect.left) + nodeRect.width / 2
        outer.scrollLeft = nodeCenter - outer.clientWidth / 2
      } else {
        outer.scrollLeft = (inner.scrollWidth - outer.clientWidth) / 2
      }
      outer.scrollTop = 0
    }, 500)
  }, [members])
  const lastDist = useRef<number|null>(null)

  const isAdmin = !!adminUser
  const isSuper = adminUser?.role === 'super'
  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }

  const toggleCollapse = (id:string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Pinch-to-zoom handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastDist.current = Math.sqrt(dx*dx + dy*dy)
    }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDist.current !== null) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx*dx + dy*dy)
      const delta = dist / lastDist.current
      setScale(s => Math.min(2, Math.max(0.3, s * delta)))
      lastDist.current = dist
    }
  }
  const handleTouchEnd = () => { lastDist.current = null }

  async function handleLogin() {
    if (!loginUsername || !loginPassword) return
    setLoginLoading(true); setLoginError('')
    const { data: rpcData } = await supabase.rpc('check_admin_password', {
      p_username: loginUsername,
      p_password: loginPassword
    })
    setLoginLoading(false)
    if (rpcData && rpcData.length > 0) {
      const admin = rpcData[0]
      setAdminUser({ username: admin.username, role: admin.role, branch: admin.family_branch })
      setShowLogin(false); setLoginUsername(''); setLoginPassword('')
      setView('admin')
      showToast(`👑 Bienvenido, ${admin.username}`)
    } else {
      setLoginError('Usuario o contraseña incorrectos')
    }
  }

  useEffect(()=>{ loadData() },[])

  async function loadData() {
    try {
      const {data,error}=await supabase.from('members').select('*').order('generation')
      if(error||!data||data.length===0){ setMembers(SAMPLE_MEMBERS as Member[]); setUsingDemo(true) }
      else{ setMembers(data); setUsingDemo(false) }
      const {data:pData}=await supabase.from('pending_edits').select('*').eq('status','pending')
      if(pData)setPending(pData)
    } catch { setMembers(SAMPLE_MEMBERS as Member[]); setUsingDemo(true) }
    setLoading(false)
  }

  // Check birthdays in next 15 days
  useEffect(()=>{
    if (members.length === 0) return
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const alive = members.filter(m => !m.died)
    const upcoming = alive.filter(m => {
      const [,mm,dd] = m.born.split('-').map(Number)
      const bday = new Date(today.getFullYear(), mm-1, dd)
      if (bday < today) bday.setFullYear(today.getFullYear()+1)
      const diff = (bday.getTime() - today.getTime()) / (1000*60*60*24)
      return diff >= 0 && diff <= 15
    }).sort((a,b) => {
      const [,am,ad] = a.born.split('-').map(Number)
      const [,bm,bd] = b.born.split('-').map(Number)
      return new Date(today.getFullYear(), am-1, ad).getTime() - new Date(today.getFullYear(), bm-1, bd).getTime()
    })
    if (upcoming.length > 0) { setBdayPopup(upcoming); setShowBdayPopup(true) }
  }, [members])

  // Close birthday popup with the Escape key
  useEffect(()=>{
    if(!showBdayPopup) return
    const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape') setShowBdayPopup(false) }
    window.addEventListener('keydown',onKey)
    return ()=>window.removeEventListener('keydown',onKey)
  }, [showBdayPopup])

  async function handleEditSubmit(updated:Member,note:string){
    if(usingDemo){ setMembers(m=>m.map(x=>x.id===updated.id?updated:x)); showToast('✅ Guardado (modo demo)') }
    else if(isAdmin){
      const{error}=await supabase.rpc('upsert_member', {p_member: memberToRpc(updated)})
      if(error){showToast('❌ Error al guardar','error');console.error(error);return}
      showToast('✅ Cambios guardados'); await loadData()
    }
    else{ const orig=members.find(m=>m.id===updated.id)!; const changes:Partial<Member>={}; (Object.keys(updated) as (keyof Member)[]).forEach(k=>{if(updated[k]!==orig[k])(changes as any)[k]=updated[k]}); const{error}=await supabase.from('pending_edits').insert({member_id:updated.id,proposed_by:'visitante',changes,note,status:'pending'}); if(error){showToast('❌ Error al enviar','error');return}; showToast('📤 Propuesta enviada a administradores','info') }
    setEditTarget(null); setSelected(null)
  }

  async function handleNewMember(m:Member){
    if(usingDemo){ setMembers(prev=>[...prev,m]); showToast('✅ Persona agregada (modo demo)') }
    else{
      const{error}=await supabase.rpc('insert_member', {p_member: memberToRpc(m)})
      if(error){showToast('❌ Error al guardar','error');console.error(error);return}
      showToast('✅ Persona agregada')
    }
    await loadData(); setShowNewMember(false)
  }

  async function handleImportExcel(file:File){
    setImporting(true)
    try{
      const XLSX=await import('xlsx')
      const buf=await file.arrayBuffer()
      const wb=XLSX.read(buf)
      const ws=wb.Sheets[wb.SheetNames[0]]
      const rows:any[]=XLSX.utils.sheet_to_json(ws,{defval:''})
      const dataRows=rows.filter((r:any)=>r.id&&r.id!=='id'&&!String(r.id).includes('Obligatorio')&&!String(r.id).includes('Opcional'))
      const mapped:Member[]=dataRows.map((r:any)=>({
        id:String(r.id||'').trim(), name:String(r.name||'').trim(), surname1:String(r.surname1||'').trim(),
        surname2:String(r.surname2||'').trim(), born:String(r.born||'').trim(),
        died:r.died?String(r.died).trim():null,
        gender:(String(r.gender||'M').trim().toUpperCase()==='F'?'F':'M') as 'M'|'F',
        generation:parseInt(String(r.generation||'1'))||1,
        spouse_id:r.spouse_id?String(r.spouse_id).trim():null,
        children_ids:r.children_ids?String(r.children_ids).split(',').map((s:string)=>s.trim()).filter(Boolean):[],
        external:String(r.external||'').toLowerCase()==='true',
        email:r.email?String(r.email).trim():null,
        bio_birthplace:r.bio_birthplace?String(r.bio_birthplace).trim():null,
        bio_education:r.bio_education?String(r.bio_education).trim():null,
        bio_occupation:r.bio_occupation?String(r.bio_occupation).trim():null,
        bio_notes:r.bio_notes?String(r.bio_notes).trim():null,
      })).filter((m:Member)=>m.id&&m.name&&m.born)
      if(!mapped.length){showToast('❌ No se encontraron datos válidos','error');setImporting(false);return}
      if(usingDemo){ setMembers(mapped); setUsingDemo(false); showToast(`✅ ${mapped.length} personas cargadas`) }
      else{ for(const m of mapped){ await supabase.rpc('upsert_member', {p_member: memberToRpc(m)}) }; await loadData(); showToast(`✅ ${mapped.length} personas importadas`) }
    } catch(e){ console.error(e); showToast('❌ Error al leer el archivo','error') }
    setImporting(false)
  }

  async function handleApprove(id:string){ const edit=pending.find(p=>p.id===id)!; const m=members.find(x=>x.id===edit.member_id); if(m){ await supabase.rpc('upsert_member', {p_member: memberToRpc({...m,...edit.changes}) }) } await supabase.from('pending_edits').update({status:'approved'}).eq('id',id); await loadData(); showToast('✅ Cambio aprobado') }
  async function handleReject(id:string){ await supabase.from('pending_edits').update({status:'rejected'}).eq('id',id); setPending(p=>p.filter(x=>x.id!==id)); showToast('🗑️ Propuesta rechazada','error') }

  async function handleChangePassword(oldPass:string,newPass:string){
    if (!adminUser) return
    const { data } = await supabase.rpc('check_admin_password', { p_username: adminUser.username, p_password: oldPass })
    if (!data || data.length === 0) { showToast('❌ Contraseña actual incorrecta','error'); return }
    const { error } = await supabase.rpc('update_admin_password', { p_username: adminUser.username, p_new_password: newPass })
    if (error) { showToast('❌ Error al cambiar contraseña','error'); return }
    showToast('✅ Contraseña actualizada')
  }

  const roots=members.filter(m=>m.generation===1&&!members.some(x=>x.children_ids?.includes(m.id)))
  const coupleRoots:Member[]=[]; const seen=new Set<string>()
  roots.forEach(r=>{if(!seen.has(r.id)){seen.add(r.id);if(r.spouse_id)seen.add(r.spouse_id);coupleRoots.push(r)}})

  const VIEWS=[
    {id:'tree',label:'🌳 Árbol'},{id:'branches',label:'🌿 Ramas'},{id:'focus',label:'🔍 Individual'},
    {id:'list',label:'📋 Lista'},
    {id:'birthdays',label:'🎂 Cumpleaños'},{id:'stats',label:'📊 Estadísticas'},
    ...(isAdmin?[{id:'admin',label:'👑 Admin'},{id:'pending',label:'⏳ Aprobar'+(pending.length>0?' ('+pending.length+')':'')}]:[]),
  ]

  if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:14,color:'#64748b'}}>Cargando árbol familiar…</div>

  return(
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      <div style={{background:'linear-gradient(135deg,#1e293b,#334155)',padding:'16px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 4px 20px rgba(0,0,0,0.2)'}}>
        <div>
          <div style={{color:'#fff',fontSize:18,fontWeight:900,letterSpacing:-0.5}}>🌳 Familia de Tezanos Pinto Domínguez</div>
          <div style={{color:'#94a3b8',fontSize:11,marginTop:2}}>{members.length} miembros{usingDemo?' · modo demo':''}</div>
        </div>
        {adminUser
          ?<button onClick={()=>setAdminUser(null)} style={{padding:'6px 12px',background:'#16a34a',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700}}>👑 {adminUser.username}</button>
          :<button onClick={()=>setShowLogin(true)} style={{padding:'6px 12px',background:'rgba(255,255,255,0.1)',color:'#fff',border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,cursor:'pointer',fontSize:12}}>🔐 Acceder</button>}
      </div>

      <div style={{background:'#fff',borderBottom:'2px solid #e2e8f0',display:'flex',gap:0,overflowX:'auto'}}>
        {VIEWS.map(v=><button key={v.id} onClick={()=>setView(v.id as any)} style={{padding:'12px 14px',border:'none',background:'none',cursor:'pointer',fontWeight:700,fontSize:12,color:view===v.id?'#7c3aed':'#64748b',borderBottom:view===v.id?'3px solid #7c3aed':'3px solid transparent',whiteSpace:'nowrap'}}>{v.label}</button>)}
      </div>

      <div style={{padding:'16px',maxWidth:1100,margin:'0 auto'}}>
        {view==='tree'&&(
          <div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginBottom:8}}>
              <button onClick={()=>setScale(s=>Math.min(2,s+0.1))} style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:16}}>+</button>
              <button onClick={()=>setScale(1)} style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:12}}>{Math.round(scale*100)}%</button>
              <button onClick={()=>setScale(s=>Math.max(0.3,s-0.1))} style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:16}}>−</button>
              <button onClick={()=>setCollapsed(new Set())} style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:12}}>Expandir todo</button>
            </div>
            <div
              ref={treeRef}
              style={{overflowX:'auto', overflowY:'auto', paddingBottom:16, maxHeight:'80vh'}}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove as any}
              onTouchEnd={handleTouchEnd}>
              <CollapseContext.Provider value={{collapsed, toggle:toggleCollapse}}>
                <div ref={treeInnerRef} style={{display:'flex',gap:48,justifyContent:'center',padding:'10px 16px',minWidth:'max-content', zoom:scale}}>
                  {coupleRoots.map(r=><TreeNode key={r.id} person={r} members={members} onSelect={setSelected} onAddMember={async(m)=>{await handleNewMember(m); await loadData()}}/>)}
                </div>
              </CollapseContext.Provider>
            </div>
            <div style={{textAlign:'center',marginTop:12,fontSize:11,color:'#94a3b8'}}>
              <span style={{color:'#d97706',fontWeight:700}}>borde dorado</span> = línea de sangre &nbsp;·&nbsp; <span style={{fontWeight:700}}>★</span> = familiar político &nbsp;·&nbsp; † fallecido &nbsp;·&nbsp; <span style={{color:'#d97706'}}>——</span> matrimonio &nbsp;·&nbsp; Toca ▲ para colapsar rama
            </div>
          </div>
        )}
        {view==='list'&&<ListView members={members} onSelect={setSelected}/>}
        {view==='branches'&&<BranchView members={members} onSelect={setSelected}/>}
        {view==='focus'&&<FocusTreeView members={members} onSelect={setSelected}/>}
        {view==='birthdays'&&<BirthdayView members={members} onSelect={setSelected}/>}
        {view==='stats'&&<StatsView members={members}/>}
        {view==='admin'&&isAdmin&&<AdminPanel onChangePassword={handleChangePassword} onImportExcel={handleImportExcel} onAddMember={()=>setShowNewMember(true)} importing={importing} members={members} isSuper={isSuper} adminUser={adminUser}/>}
        {view==='pending'&&isAdmin&&<PendingView pending={pending} members={members} onApprove={handleApprove} onReject={handleReject} onEdit={setEditTarget}/>}
      </div>

      {selected&&<PersonCard person={selected} members={members} onClose={()=>setSelected(null)} onEdit={setEditTarget} isAdmin={isAdmin}/>}
      {editTarget&&<EditModal person={editTarget} isAdmin={isAdmin} onClose={()=>setEditTarget(null)} onSubmit={handleEditSubmit}/>}
      {showNewMember&&<NewMemberModal onClose={()=>setShowNewMember(false)} onSave={handleNewMember}/>}

      {showLogin&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:3000}} onClick={()=>{setShowLogin(false);setLoginError('')}}>
        <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:320,width:'100%'}} onClick={e=>e.stopPropagation()}>
          <div style={{fontWeight:800,fontSize:17,marginBottom:16}}>🔐 Acceso administrador</div>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600,marginBottom:10}}>
            Usuario
            <input value={loginUsername} onChange={e=>setLoginUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{padding:'10px 12px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:14,outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:'#64748b',fontWeight:600,marginBottom:10}}>
            Contraseña
            <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{padding:'10px 12px',borderRadius:8,border:'2px solid #e2e8f0',fontSize:14,outline:'none'}}/>
          </label>
          {loginError&&<div style={{fontSize:12,color:'#dc2626',marginBottom:10}}>{loginError}</div>}
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{setShowLogin(false);setLoginError('')}} style={{flex:1,padding:10,background:'#f1f5f9',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Cancelar</button>
            <button onClick={handleLogin} disabled={loginLoading} style={{flex:1,padding:10,background:loginLoading?'#94a3b8':'#1e293b',color:'#fff',border:'none',borderRadius:8,cursor:loginLoading?'not-allowed':'pointer',fontWeight:700,fontSize:13}}>
              {loginLoading?'⏳ Verificando...':'Entrar'}
            </button>
          </div>
        </div>
      </div>}

      {showBdayPopup&&bdayPopup.length>0&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4000,padding:20}} onClick={()=>setShowBdayPopup(false)}>
          <div style={{background:'#fff',borderRadius:20,padding:24,maxWidth:400,width:'100%',maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
            <div style={{position:'relative',background:'linear-gradient(135deg,#7c3aed,#db2777)',borderRadius:12,padding:'14px 16px',marginBottom:16,color:'#fff',textAlign:'center',flexShrink:0}}>
              <button onClick={()=>setShowBdayPopup(false)} aria-label="Cerrar" style={{position:'absolute',top:8,right:10,background:'rgba(255,255,255,0.2)',border:'none',width:26,height:26,borderRadius:'50%',color:'#fff',fontSize:18,lineHeight:'1',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
              <div style={{fontSize:28,marginBottom:4}}>🎂</div>
              <div style={{fontWeight:800,fontSize:16}}>Cumpleaños próximos</div>
              <div style={{fontSize:12,opacity:0.85,marginTop:2}}>En los próximos 15 días · {bdayPopup.length}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16,overflowY:'auto',flex:'1 1 auto',minHeight:0}}>
              {bdayPopup.map(p=>{
                const now=new Date()
                const today=new Date(now.getFullYear(),now.getMonth(),now.getDate())
                const [,mm,dd]=p.born.split('-').map(Number)
                const bday=new Date(today.getFullYear(),mm-1,dd)
                if(bday<today)bday.setFullYear(today.getFullYear()+1)
                const diff=Math.round((bday.getTime()-today.getTime())/(1000*60*60*24))
                const age=today.getFullYear()-Number(p.born.split('-')[0])
                return <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'#f8fafc',borderRadius:10}}>
                  <Avatar p={p} size={40}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{fullName(p)}</div>
                    <div style={{fontSize:12,color:'#64748b'}}>{p.born.slice(8)}/{p.born.slice(5,7)} · cumple {age} años</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    {diff===0
                      ? <div style={{background:'#fef9c3',color:'#92400e',borderRadius:8,padding:'3px 8px',fontSize:11,fontWeight:700}}>¡Hoy! 🎉</div>
                      : <div style={{background:'#ede9fe',color:'#7c3aed',borderRadius:8,padding:'3px 8px',fontSize:11,fontWeight:700}}>en {diff} día{diff!==1?'s':''}</div>
                    }
                  </div>
                </div>
              })}
            </div>
            <button onClick={()=>setShowBdayPopup(false)} style={{width:'100%',padding:'10px',background:'#1e293b',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:14,flexShrink:0}}>
              ¡Entendido!
            </button>
          </div>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:toast.type==='error'?'#dc2626':toast.type==='info'?'#2563eb':'#16a34a',color:'#fff',padding:'10px 20px',borderRadius:30,fontWeight:700,fontSize:13,boxShadow:'0 8px 25px rgba(0,0,0,0.2)',zIndex:5000,whiteSpace:'nowrap'}}>{toast.msg}</div>}
    </div>
  )
}
