"""Build the editable development rig and authored motion drafts. Blender 4.3."""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from math import sin, cos, pi

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / 'src/qa'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
V = lambda x, z, y: Vector((x, -z, y))
UP = V(0,0,1)
def mat(name, color, rough=.75):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*color,1); b.inputs['Roughness'].default_value=rough
    return m
fabric=mat('Cotton · warm porcelain',(.85,.87,.88))
fold=mat('Seams · cool cotton',(.66,.70,.74))
lapel=mat('Lapel · white cotton',(.97,.97,.94))
navy=mat('Belt and collar · midnight',(.025,.043,.077))
skin=mat('Skin · soft amber',(.58,.33,.21))
skin_shadow=mat('Skin · warm shadow',(.44,.22,.14))
hair=mat('Hair · ink',(.026,.021,.025))
eye=mat('Eyes · dark brown',(.034,.022,.020),.46)
white=mat('Eyes · off white',(.89,.87,.81),.48)
teal=mat('Stitch · jade',(.10,.43,.37))
arm=bpy.data.armatures.new('Dojo study rig')
rig=bpy.data.objects.new('DojoCharacter',arm); scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
parents={}
def bone(name,a,b,parent=None):
    n=arm.edit_bones.new(name); n.head=a; n.tail=b; n.use_deform=name!='MotionRoot'
    if parent: n.parent=arm.edit_bones[parent]
    parents[name]=parent

def ik(a,b,l1,l2,pole):
    delta=b-a; length=max(.001,delta.length); direction=delta/length
    reach=max(abs(l1-l2)+.0001,min(l1+l2-.0001,length))
    half=(l1*l1-l2*l2+reach*reach)/(2*reach)
    perpendicular=pole-direction*pole.dot(direction)
    if perpendicular.length<.001: perpendicular=direction.cross(V(1,.3,.1))
    knee=a+direction*half+perpendicular.normalized()*math.sqrt(max(0,l1*l1-half*half))
    return knee,a+direction*reach

# Pose coordinates are (character right-axis X, forward Z, up Y).
def pose(h=.98, center=(0,0), feet=None, hands=None, yaw=0, pitch=None):
    return dict(h=h, center=center, feet=feet or ((.127,0,.095),(-.127,0,.095)),
                hands=hands or ((.28,.05,1.015),(-.28,.05,1.015)),yaw=yaw,pitch=pitch or (0,0))

REST=pose(h=1.02,hands=((.485,.025,1.025),(-.485,.025,1.025)))
def points(p):
    yaw=p['yaw']; rot=Matrix.Rotation(yaw,3,'Z'); c=V(*p['center'],0)
    def tr(x,z,y): return c+rot@V(x,z,y)
    h=p['h']; hip=tr(0,0,h)
    out={'MotionRoot':(c,c+UP*.15),'Hips':(hip,hip+UP*.16),
         'Spine':(hip+UP*.16,hip+UP*.265),'Chest':(hip+UP*.265,hip+UP*.367),
         'Neck':(hip+UP*.367,hip+UP*.420),'Head':(hip+UP*.420,hip+UP*.665)}
    for i,side in enumerate(('L','R')):
        s=1 if i==0 else -1
        a=tr(s*.112,0,h-.064)
        ankle=V(*p['feet'][i])
        knee,ankle=ik(a,ankle,.435,.435,rot@V(s*.22,1,0))
        toe=ankle+rot@V(s*.006,.175*cos(p['pitch'][i]),-.039+.175*sin(p['pitch'][i]))
        out.update({f'Thigh_{side}':(a,knee),f'Shin_{side}':(knee,ankle),f'Foot_{side}':(ankle,toe),
                    f'Toe_{side}':(toe,toe+rot@V(0,.046,0))})
        sh=tr(s*.218,.006,h+.319)
        target=p['hands'][i]
        elbow,wrist=ik(sh,tr(target[0],target[1],target[2]+h-.98),.276,.253,rot@V(s*.90,-.52,-.66))
        handdir=(wrist-elbow).normalized()
        out.update({f'Clavicle_{side}':(tr(s*.04,0,h+.319),sh),f'UpperArm_{side}':(sh,elbow),
                    f'Forearm_{side}':(elbow,wrist),f'Hand_{side}':(wrist,wrist+handdir*.12)})
    return out

r=points(REST)
chain=['MotionRoot','Hips','Spine','Chest','Neck','Head']
for i,n in enumerate(chain): bone(n,*r[n],chain[i-1] if i else None)
for side in ('L','R'):
    for names,parent in [(['Thigh','Shin','Foot','Toe'],'Hips'),(['Clavicle','UpperArm','Forearm','Hand'],'Chest')]:
        for n in names:
            name=n+'_'+side; bone(name,*r[name],parent); parent=name
    a,b=r['Hand_'+side]; direct=(b-a).normalized()
    across=direct.cross(V(0,-1,0)).normalized()
    for fi,finger in enumerate(('Thumb','Index','Middle','Ring','Pinky')):
        parent='Hand_'+side
        for seg in range(3):
            start=a+direct*(.035+.021*seg)+across*((fi-2)*.015)
            end=start+direct*.021
            n=f'{finger}{seg+1}_{side}'; bone(n,start,end,parent); parent=n
bpy.ops.object.mode_set(mode='OBJECT')

def bind(obj,weights):
    obj.parent=rig
    mod=obj.modifiers.new('Deform','ARMATURE'); mod.object=rig
    for key,items in weights.items():
        group=obj.vertex_groups.new(name=key)
        for idx,w in items: group.add([idx],w,'REPLACE')
    for f in obj.data.polygons: f.use_smooth=True
    return obj

def mesh(name,verts,faces,m,weights):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); data.materials.append(m)
    return bind(o,weights)

def ball(name,c,scale,m,b,axis=None,seg=24,rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=c)
    o=bpy.context.object; o.name=name; o.scale=scale
    if axis is not None: o.rotation_mode='QUATERNION'; o.rotation_quaternion=axis.normalized().to_track_quat('Y','Z')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.data.materials.append(m); return bind(o,{b:[(i,1) for i in range(len(o.data.vertices))]})

def surface(name,rings,m,n=28):
    # (center, tangent, rx, ry, bone weights). Smooth weighted garment across joints.
    verts=[]; faces=[]; weights={}
    for i,(c,d,rx,ry,groups) in enumerate(rings):
        d=d.normalized()
        u=V(1,0,0)-d*d.dot(V(1,0,0))
        if u.length<.01: u=V(0,1,0)-d*d.dot(V(0,1,0))
        u.normalize(); v=d.cross(u).normalized()
        for j in range(n):
            t=2*pi*j/n
            verts.append(c+u*(rx*cos(t))+v*(ry*sin(t)))
            for k,w in groups.items():
                if w>0: weights.setdefault(k,[]).append((i*n+j,w))
    for i in range(len(rings)-1):
        for j in range(n):
            a=i*n+j; b=i*n+(j+1)%n
            faces.append((a,b,b+n,a+n))
    faces.extend([tuple(reversed(range(n))),tuple(range((len(rings)-1)*n,len(rings)*n))])
    return mesh(name,verts,faces,m,weights)

def cord(name,coords,radius,m,b):
    return surface(name,[(v,(coords[min(i+1,len(coords)-1)]-coords[max(0,i-1)]),radius,radius,{b:1})
                         for i,v in enumerate(coords)],m,12)

def column(name, profile, m):
    return surface(name,[(V(0,fo,z),UP,x,y,weights) for z,fo,x,y,weights in profile],m,48)
column('Dobok · fitted jacket',[
    (.853,0,.176,.111,{'Hips':1}),(.876,0,.205,.132,{'Hips':1}),
    (.990,0,.207,.137,{'Hips':1}),(1.071,.004,.198,.126,{'Hips':.8,'Spine':.2}),
    (1.171,.003,.192,.126,{'Spine':1}),(1.272,.005,.219,.136,{'Chest':1}),
    (1.342,.000,.233,.129,{'Chest':1}),(1.386,-.006,.192,.103,{'Chest':1}),
    (1.416,0,.100,.079,{'Chest':1})],fabric)
column('Trouser waist',[(.862,0,.206,.131,{'Hips':1}),(.923,0,.215,.139,{'Hips':1}),
    (1.045,0,.181,.112,{'Hips':1})],fabric)
column('Midnight belt',[(1.025,0,.218,.148,{'Hips':1}),(1.032,0,.225,.157,{'Hips':1}),
    (1.080,0,.223,.153,{'Hips':1}),(1.086,0,.217,.148,{'Hips':1})],navy)
ball('Belt knot',V(.013,.157,1.055),(.079,.040,.033),navy,'Hips')
cord('Belt tail left',[V(.009,.172,1.054),V(.040,.158,.978),V(.068,.146,.903)],.019,navy,'Hips')
cord('Belt tail right',[V(.021,.168,1.058),V(-.029,.152,.984),V(-.064,.142,.923)],.021,navy,'Hips')
cord('Belt stitch',[V(-.074,.147,.945),V(-.060,.158,.940),V(-.045,.150,.933)],.004,teal,'Hips')
for s in (-1,1):
    cord('Lapel cotton',[V(s*.080,.060,1.408),V(s*.105,.111,1.367),
        V(s*.070,.138,1.312),V(0,.146,1.237),V(-s*.065,.138,1.161)],.022,lapel,'Chest')
    cord('Lapel navy',[V(s*.079,.069,1.412),V(s*.105,.125,1.370),
        V(s*.065,.153,1.316),V(0,.158,1.247)],.010,navy,'Chest')
cord('Jacket seam',[V(0,.141,1.233),V(.065,.128,1.161),V(.082,.121,1.091)],.004,fold,'Chest')
ball('Neck',V(0,0,1.423),(.079,.078,.109),skin,'Neck')
ball('Head',V(0,.007,1.542),(.111,.100,.142),skin,'Head',seg=40,rings=24)
ball('Jaw',V(0,.038,1.485),(.088,.078,.078),skin,'Head')
ball('Nose',V(0,.106,1.529),(.023,.026,.029),skin,'Head')
for s in (-1,1):
    ball('Ear',V(s*.105,0,1.537),(.025,.035,.044),skin,'Head')
    ball('Ear detail',V(s*.119,.014,1.537),(.012,.018,.025),skin_shadow,'Head')
    ball('Eye',V(s*.046,.098,1.555),(.027,.012,.012),white,'Head')
    ball('Pupil',V(s*.045,.109,1.555),(.012,.005,.010),eye,'Head')
    cord('Brow',[V(s*.021,.103,1.578),V(s*.046,.105,1.583),V(s*.074,.094,1.577)],.005,hair,'Head')
cord('Mouth',[V(-.029,.105,1.488),V(0,.116,1.483),V(.027,.107,1.490)],.0035,skin_shadow,'Head')
# Trimmed cap with a slightly asymmetric swept hairline.
hairv=[]; hairf=[]; nh=48; nr=16
for i in range(nr+1):
    for j in range(nh):
        t=2*pi*j/nh
        maxphi=1.91-.52*max(0,cos(t))+.08*sin(t*2)*max(0,cos(t))
        phi=.013+(maxphi-.013)*i/nr
        hairv.append(V(.121*sin(phi)*sin(t),.006+.108*sin(phi)*cos(t),1.56+.132*cos(phi)))
for i in range(nr):
    for j in range(nh): hairf.append((i*nh+j,(i+1)*nh+j,(i+1)*nh+(j+1)%nh,i*nh+(j+1)%nh))
mesh('Swept hair',hairv,hairf,hair,{'Head':[(i,1) for i in range(len(hairv))]})
for side in ('L','R'):
    a,b=r['UpperArm_'+side]; c=r['Forearm_'+side][1]
    u=b-a; v=c-b
    surface('Dobok sleeve '+side,[
        (a-u*.22,u,.082,.087,{'UpperArm_'+side:1}),
        (a,u,.101,.096,{'UpperArm_'+side:1}),
        (a+u*.27,u,.092,.088,{'UpperArm_'+side:1}),
        (a+u*.76,u,.073,.074,{'UpperArm_'+side:1}),
        (b,u+v,.071,.069,{'UpperArm_'+side:.5,'Forearm_'+side:.5}),
        (b+v*.32,v,.069,.065,{'Forearm_'+side:1}),
        (b+v*.79,v,.057,.052,{'Forearm_'+side:1}),
        (b+v*.94,v,.057,.050,{'Forearm_'+side:1})],fabric)
    surface('Sleeve hem '+side,[(b+v*.88,v,.057,.050,{'Forearm_'+side:1}),
                                (b+v*.94,v,.058,.051,{'Forearm_'+side:1})],fold)
    ha,hb=r['Hand_'+side]; hd=(hb-ha).normalized(); axis=hd.cross(V(0,-1,0)).normalized()
    ball('Wrist '+side,ha,(.039,.045,.033),skin,'Hand_'+side,hd)
    ball('Palm '+side,ha+hd*.059,(.043,.055,.035),skin,'Hand_'+side,hd)
    for j,name in enumerate(('Index','Middle','Ring','Pinky')):
        center=ha+hd*(.093-abs(j-1.5)*.006)+axis*((j-1.5)*.018)
        ball('Knuckle '+name+' '+side,center,(.013,.022,.020),skin,name+'3_'+side,hd,16,10)
    ball('Thumb '+side,ha+hd*.065-axis*.038,(.018,.032,.017),skin,'Thumb2_'+side,hd,18,10)
    a,b=r['Thigh_'+side]; c=r['Shin_'+side][1]; u=b-a; v=c-b
    surface('Trouser leg '+side,[
        (a-u*.17,u,.105,.108,{'Thigh_'+side:1}),
        (a,u,.117,.116,{'Thigh_'+side:1}),
        (a+u*.33,u,.110,.112,{'Thigh_'+side:1}),
        (a+u*.74,u,.092,.092,{'Thigh_'+side:1}),
        (b,u+v,.087,.082,{'Thigh_'+side:.53,'Shin_'+side:.47}),
        (b+v*.32,v,.081,.081,{'Shin_'+side:1}),
        (b+v*.70,v,.069,.071,{'Shin_'+side:1}),
        (b+v*.91,v,.067,.066,{'Shin_'+side:1})],fabric)
    surface('Trouser hem '+side,[(b+v*.86,v,.068,.067,{'Shin_'+side:1}),
                                  (b+v*.91,v,.067,.066,{'Shin_'+side:1})],fold)
    foot=r['Foot_'+side][0]
    ball('Bare foot '+side,foot+V(0,.058,-.037),(.061,.118,.054),skin,'Foot_'+side)
    for j in range(5):
        sign=1 if side=='L' else -1
        ball('Toe '+str(j)+' '+side,foot+V(sign*(j-2)*.019,.160-j*.008,-.063),
             (.014-.0011*j,.030-.002*j,.022-.001*j),skin,'Toe_'+side,seg=16,rings=10)

# Hand-authored drafts use world foot anchors, a two-link IK solve and joint keyframes.
ready=pose(h=.974,hands=((.13,.255,1.009),(-.13,.255,1.009)))
stand=pose(h=1.011,hands=((.267,.007,.980),(-.267,.007,.980)))
step=pose(h=.947,center=(0,.172),feet=((.143,.48,.095),(-.137,-.045,.095)),hands=ready['hands'])
deep=pose(h=.875,center=(0,.24),feet=((.155,.68,.095),(-.140,-.105,.095)),hands=ready['hands'])
horse=pose(h=.863,feet=((.350,0,.095),(-.350,0,.095)),hands=((.237,.028,1.10),(-.237,.028,1.10)))
def amend(p,**kw): return {**p,**kw}
def lift(p,i,amount=.14):
    f=list(p['feet']); x,y,z=f[i]; f[i]=(x,y,z+amount); return amend(p,feet=tuple(f))
def hands(p,a,b): return amend(p,hands=(a,b))
hiphand=(-.218,.035,1.124)
def mirror(p):
    def f(a): return (-a[0],a[1],a[2])
    return amend(p,center=(-p['center'][0],p['center'][1]),yaw=-p['yaw'],
                 hands=(f(p['hands'][1]),f(p['hands'][0])),feet=(f(p['feet'][1]),f(p['feet'][0])),
                 pitch=tuple(reversed(p['pitch'])))
def place(p,x,z,yaw):
    def xf(f):
        a,b,c=f; return (x+a*cos(yaw)+b*sin(yaw),z-a*sin(yaw)+b*cos(yaw),c)
    c=xf((*p['center'],0))
    return amend(p,center=c[:2],feet=tuple(xf(f) for f in p['feet']),yaw=yaw+p['yaw'])
clips={}
def add(id,frames,mirror_ok=False):
    clips[id]=frames
    if mirror_ok: clips[id+'-R']=[(t,mirror(p)) for t,p in frames]
add('B00',[(0,stand),(.65,stand),(1.6,ready),(2.8,ready),(3.6,stand),(4,stand)])
add('B01',[(0,ready),(.55,ready),(1.35,lift(amend(step,center=(0,.105)),0)),(2.15,step),(3.5,step)],True)
add('B02',[(0,ready),(.55,ready),(1.15,lift(amend(horse,feet=((.350,0,.095),(-.127,0,.095)),h=.93),0,.10)),
           (1.85,lift(horse,1,.10)),(2.45,horse),(3.8,horse)])
add('B03',[(0,ready),(.55,ready),(1.32,lift(amend(deep,center=(0,.14),h=.923),0,.13)),(2.2,deep),(3.6,deep)],True)
add('B04',[(0,step),(.55,hands(step,(-.07,.247,1.344),(-.157,.32,1.18))),
           (1.15,hands(step,(.09,.317,1.142),hiphand)),(1.8,hands(step,(.174,.361,.978),hiphand)),
           (3.2,hands(step,(.174,.361,.978),hiphand))],True)
add('B05',[(0,step),(.60,hands(step,(.432,.13,1.332),(-.135,.301,1.19))),
           (1.22,hands(step,(.26,.332,1.310),hiphand)),(1.86,hands(step,(.028,.362,1.249),hiphand)),
           (3.3,hands(step,(.028,.362,1.249),hiphand))],True)
add('B06',[(0,step),(.62,hands(step,(-.041,.20,1.13),(-.12,.34,1.28))),
           (1.25,hands(step,(.117,.347,1.408),hiphand)),(1.87,hands(step,(-.044,.158,1.571),hiphand)),
           (3.3,hands(step,(-.044,.158,1.571),hiphand))],True)
add('B07',[(0,hands(deep,(.217,.021,1.12),(-.075,.30,1.23))),(.72,hands(deep,(.217,.021,1.12),(-.075,.30,1.23))),
           (1.40,hands(deep,(.133,.472,1.249),hiphand)),(2.45,hands(deep,(.133,.472,1.249),hiphand)),
           (3.2,hands(deep,(.217,.021,1.12),hiphand))],True)
clips['B07-reverse']=[(t,amend(p,feet=deep['feet'])) for t,p in clips['B07-R']]
clips['B07-reverse-R']=[(t,mirror(p)) for t,p in clips['B07-reverse']]
kickbase=pose(h=.968,center=(-.088,.005),feet=((.124,-.115,.095),(-.126,.035,.095)),
              hands=((.17,.205,1.23),(-.19,.236,1.23)))
chamber=amend(kickbase,h=.969,feet=((.091,.274,.510),(-.126,.035,.095)),pitch=(-.92,0))
extend=amend(chamber,feet=((.094,.865,1.005),(-.126,.035,.095)),pitch=(.27,0))
land=amend(kickbase,h=.928,center=(-.026,.16),feet=((.129,.424,.095),(-.126,.035,.095)))
add('B08',[(0,kickbase),(.65,kickbase),(1.34,chamber),(1.98,extend),(2.29,extend),
           (2.89,chamber),(3.63,land),(4.35,land),(4.8,land)],True)
turned=place(step,.17,.1,pi/2)
add('B09',[(0,ready),(.58,ready),(1.31,amend(lift(ready,0,.09),yaw=pi/3)),
           (2.02,turned),(3.3,turned)],True)
# An engineering exercise to test continuous sequenced playback, separate from Taegeuk 1.
t1=place(step,0,0,0)
t2=place(step,.05,.52,pi/2)
t3=place(step,-.60,.53,pi)
t4=place(ready,-.60,.05,pi)
add('direction-lab',[(0,ready),(.48,ready),(1.0,lift(t1,0)),(1.65,t1),
    (2.05,lift(amend(t1,yaw=pi/4),1,.12)),(3.3,t2),
    (3.9,lift(amend(t2,yaw=pi*.75),0,.12)),(5.0,t3),
    (5.60,lift(t4,1,.11)),(6.6,t4),(8.0,t4)])

def mix(a,b,f):
    if isinstance(a,tuple): return tuple(mix(x,y,f) for x,y in zip(a,b))
    return a+(b-a)*f
def evaluate(frames,t):
    for (t0,p0),(t1,p1) in zip(frames,frames[1:]):
        if t<=t1+1e-9:
            f=max(0,min(1,(t-t0)/(t1-t0))); f=f*f*(3-2*f)
            return {k:mix(p0[k],p1[k],f) for k in p0}
    return frames[-1][1]
def coords(v): return [round(v.x,5),round(v.z,5),round(-v.y,5)]
def matrix(n,a,b,yaw):
    ry=(b-a).normalized()
    side=Matrix.Rotation(yaw,3,'Z')@V(1,0,0)
    if n.startswith(('Forearm','Hand','UpperArm','Clavicle')):
        side=Matrix.Rotation(yaw,3,'Z')@V(.24,1,.15)
    rx=(side-ry*side.dot(ry)).normalized()
    if rx.length<.01: rx=ry.cross(UP).normalized()
    rz=rx.cross(ry).normalized()
    m=Matrix((rx,ry,rz)).transposed().to_4x4(); m.translation=a
    return m

restm={n:arm.bones[n].matrix_local.copy() for n in parents}
rest_target={n:matrix(n,*r[n],0) for n in r}
offset={n:rest_target[n].inverted()@restm[n] for n in r}
rig.animation_data_create()
anims={}
for key,frames in clips.items():
    action=bpy.data.actions.new(key)
    rig.animation_data.action=action
    prevq={}
    samples=[]
    last=math.ceil(frames[-1][0]*30)
    for frame in range(last+1):
        t=frame/30; p=evaluate(frames,t); ps=points(p)
        target={n:matrix(n,*ps[n],p['yaw'])@offset[n] for n in r}
        for n in r:
            parent=parents[n]
            relative=(restm[parent].inverted()@restm[n]).inverted()@target[parent].inverted()@target[n] if parent else restm[n].inverted()@target[n]
            loc,q,_=relative.decompose()
            if n in prevq and q.dot(prevq[n])<0: q.negate()
            prevq[n]=q.copy()
            pb=rig.pose.bones[n]; pb.rotation_mode='QUATERNION'
            pb.location=loc; pb.rotation_quaternion=q
            pb.keyframe_insert(data_path='location',frame=frame,group=n)
            pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=n)
        samples.append({'t':round(t,6),'yaw':round(p['yaw'],6),'j':{n:coords(ps[n][0]) for n in r if not n.startswith(('Clavicle_','Toe_')) and n!='Spine'},
                        'tip':{n:coords(ps[n][1]) for n in ('Hand_L','Hand_R','Foot_L','Foot_R','Head')}})
    for f in action.fcurves:
        for k in f.keyframe_points: k.interpolation='LINEAR'
    rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new(); track.name=key
    strip=track.strips.new(key,0,action); strip.name=key
    anims[key]={'duration':last/30,'frames':samples}
scene.frame_set(0)
scene.frame_start=0; scene.frame_end=240
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True); bpy.context.view_layer.objects.active=rig
scene.world=bpy.data.worlds.new('Studio')
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'assets-source/dojo-rig.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'dojo-draft.glb'),export_format='GLB',
    export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,
    export_force_sampling=True,export_yup=True,export_cameras=False,export_lights=False)
(OUT/'motion-tracks.json').write_text(json.dumps(anims,ensure_ascii=False,separators=(',',':')))
(OUT/'rig-contract.json').write_text(json.dumps({'rigVersion':'dojo-rig-1','unit':'m','up':'+Y',
    'front':'+Z','right':'-X','motionRoot':'MotionRoot','parents':parents,
    'restHeads':{k:coords(v[0]) for k,v in r.items()}},indent=2))
print(f'Exported {len(clips)} development clips.')
