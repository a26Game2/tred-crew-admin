import { useEffect, useRef, useState } from 'react';

export type AvatarConfig = { gender: 'MASCULINE' | 'FEMININE'; skinTone: 'LIGHT' | 'WARM' | 'TAN' | 'DEEP'; hairStyle: 'CLASSIC' | 'SHORT' | 'SPIKY' | 'BOB' | 'LONG'; hairColor: string; outfitStyle: 'TRED' | 'CASUAL' | 'FORMAL' | 'CREATIVE'; outfitColor: string; accessory: 'NONE' | 'GLASSES' | 'HEADPHONES' | 'CAP' };
export type OfficeMember = { id: string; displayName: string; avatarUrl?: string | null; avatarConfig?: AvatarConfig | null; employeeType: { name: string }; attendance?: { type: 'DAILY' | 'EVENT'; checkInAt: string; checkOutAt?: string | null; event?: { id: string; name: string; location?: string | null; startAt?: string; endAt?: string } | null } | null };
export type OfficeRoom = { id: string; name: string; employees: OfficeMember[] };
export type OfficeEventGroup = { id: string; name: string; location?: string | null; members: Array<{ member: OfficeMember; room: OfficeRoom }> };
type Props = { departments: OfficeRoom[]; onSelect: (member: OfficeMember, department: OfficeRoom) => void };
const skinColors: Record<AvatarConfig['skinTone'], string> = { LIGHT: '#F7D8C2', WARM: '#E9B58F', TAN: '#C9865D', DEEP: '#81503A' };

function CustomAvatar({ config }: { config: AvatarConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const context = canvas.getContext('2d'); if (!context) return;
    const scale = canvas.width / 256; context.clearRect(0, 0, canvas.width, canvas.height); context.save(); context.scale(scale, scale);
    const skin = skinColors[config.skinTone]; const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => { context.beginPath(); context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); context.fillStyle = color; context.fill(); }; const rounded = (x: number, y: number, width: number, height: number, radius: number, color: string) => { context.beginPath(); context.roundRect(x, y, width, height, radius); context.fillStyle = color; context.fill(); };
    ellipse(128, 298, 65, 13, '#21322633'); rounded(72, 175, 112, 91, config.gender === 'FEMININE' ? 34 : 25, config.outfitColor); rounded(82, 244, 35, 46, 14, skin); rounded(139, 244, 35, 46, 14, skin); rounded(73, 277, 48, 18, 9, '#26313A'); rounded(135, 277, 48, 18, 9, '#26313A'); rounded(49, 178, 30, 78, 15, skin); rounded(177, 178, 30, 78, 15, skin); rounded(108, 154, 40, 42, 12, skin); ellipse(128, 111, 64, 69, skin); ellipse(64, 116, 12, 22, skin); ellipse(192, 116, 12, 22, skin);
    if (config.hairStyle === 'SPIKY') { context.beginPath(); context.moveTo(64, 107); [[70,52],[86,66],[100,27],[116,61],[139,25],[151,65],[181,42],[194,108]].forEach(([x,y]) => context.lineTo(x,y)); context.closePath(); context.fillStyle=config.hairColor;context.fill(); } else { ellipse(128, config.hairStyle === 'SHORT' ? 69 : 65, 67, config.hairStyle === 'SHORT' ? 44 : 55, config.hairColor); if (config.hairStyle === 'BOB' || config.hairStyle === 'LONG') { rounded(61,65,27,config.hairStyle === 'LONG' ? 130 : 92,13,config.hairColor);rounded(168,65,27,config.hairStyle === 'LONG' ? 130 : 92,13,config.hairColor); } }
    ellipse(103,116,7,9,'#24262A');ellipse(153,116,7,9,'#24262A');ellipse(101,113,2,3,'#FFF');ellipse(151,113,2,3,'#FFF');context.beginPath();context.arc(128,140,11,.2,Math.PI-.2);context.strokeStyle='#9F584E';context.lineWidth=3;context.stroke();rounded(118,183,20,52,5,'#FFFFFFC7');ellipse(128,206,13,13,'#FFF');context.fillStyle=config.outfitColor;context.font='bold 15px Arial';context.textAlign='center';context.fillText('T',128,211);
    if(config.accessory==='GLASSES'){context.strokeStyle='#30343A';context.lineWidth=4;context.strokeRect(84,102,38,27);context.strokeRect(134,102,38,27);context.beginPath();context.moveTo(122,114);context.lineTo(134,114);context.stroke();} if(config.accessory==='HEADPHONES'){context.beginPath();context.arc(128,105,76,Math.PI,Math.PI*2);context.strokeStyle='#374151';context.lineWidth=10;context.stroke();rounded(48,101,17,45,7,'#374151');rounded(191,101,17,45,7,'#374151');} if(config.accessory==='CAP'){ellipse(128,55,68,34,config.outfitColor);rounded(124,70,82,12,6,config.outfitColor);} context.restore();
  }, [config]);
  return <canvas ref={canvasRef} width={256} height={320}/>;
}

function Person({ member, room, onSelect }: { member: OfficeMember; room: OfficeRoom; onSelect: Props['onSelect'] }) {
  const presence = member.attendance?.type === 'EVENT' ? 'event' : member.attendance ? 'working' : 'offline';
  return <button className={`office-25d-person ${presence}`} onClick={() => onSelect(member, room)} aria-label={`${member.displayName} — ${presence === 'event' ? 'đi sự kiện' : presence === 'working' ? 'đang làm việc' : 'chưa check-in'}`}>
    <span className="office-25d-character">{member.avatarConfig ? <CustomAvatar config={member.avatarConfig}/> : <img src="/assets/tred-classic-tiger.png" alt=""/>}</span><strong>{member.displayName}</strong><i/>
  </button>;
}

export function Office25DScene({ departments, onSelect }: Props) {
  const [zoom, setZoom] = useState(1);
  const changeZoom = (step: number) => setZoom((current) => Math.min(1.2, Math.max(.7, Number((current + step).toFixed(1)))));
  return <div className="office-25d-scene office-25d-viewport" role="application" aria-label="Văn phòng 2.5D TRED. Bấm vào nhân vật để xem trạng thái.">
    <div className="office-25d-stage office-25d-cozy" style={{ transform: `scale(${zoom})` }}>
      <div className="office-25d-rooms">{departments.map((room, index) => <section className={`office-25d-room room-${index % 4}`} key={room.id}><div className="office-25d-wall"><h3>{room.name}</h3><small>{room.employees.length} nhân sự</small></div><div className="office-25d-floor">{room.employees.map((member) => <Person key={member.id} member={member} room={room} onSelect={onSelect}/>)}{!room.employees.length && <span className="office-25d-vacant">Khu vực đang trống</span>}</div></section>)}</div>
    </div>
    <div className="office-zoom-controls" aria-label="Điều chỉnh thu phóng"><button type="button" onClick={() => changeZoom(-.1)} disabled={zoom <= .7} aria-label="Thu nhỏ">−</button><output aria-live="polite">{Math.round(zoom * 100)}%</output><button type="button" onClick={() => changeZoom(.1)} disabled={zoom >= 1.2} aria-label="Phóng to">+</button><button type="button" className="office-zoom-reset" onClick={() => setZoom(1)} disabled={zoom === 1}>100%</button></div>
  </div>;
}

export function Outdoor25DScene({ events, onSelect }: { events: OfficeEventGroup[]; onSelect: Props['onSelect'] }) {
  return <div className="office-25d-scene outdoor-25d-scene" role="application" aria-label="Khu sự kiện ngoài trời 2.5D. Bấm vào nhân vật để xem trạng thái.">
    <div className="outdoor-event-zones">
      {events.map((event, index) => <section className={`outdoor-event-zone zone-${index % 3}`} key={event.id}>
        <header><span>Đang tham dự</span><h3>{event.name}</h3>{event.location && <small>⌖ {event.location}</small>}<b>{event.members.length} nhân sự</b></header>
        <div className="outdoor-event-people">{event.members.map(({ member, room }) => <Person key={member.id} member={member} room={room} onSelect={onSelect}/>)}</div>
      </section>)}
      {!events.length && <div className="outdoor-empty"><strong>Chưa có nhân viên tham dự sự kiện</strong><span>Nhân sự check-in theo sự kiện sẽ xuất hiện tại đây.</span></div>}
    </div>
  </div>;
}
