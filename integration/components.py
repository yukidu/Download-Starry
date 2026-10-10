"""Verified component downloads staged for application before application imports."""
from __future__ import annotations
import hashlib, io, json, os, re, shutil, socket, subprocess, sys, threading, time, uuid, zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse
import urllib.request

LABELS = {'yt-dlp':'影片解析元件 yt-dlp','yt-dlp-ejs':'YouTube JavaScript 支援','ffmpeg':'影片轉檔元件 FFmpeg','wechat':'微信影音號引擎','deno':'YouTube JavaScript 執行元件 Deno'}
ALLOWED_HOSTS = {'pypi.org','files.pythonhosted.org','api.github.com','github.com','release-assets.githubusercontent.com','objects.githubusercontent.com','github-releases.githubusercontent.com'}

class OfficialRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlparse(newurl).scheme!='https' or urlparse(newurl).hostname not in ALLOWED_HOSTS:raise ValueError('下載轉址不在官方來源清單內。')
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def fetch(url, limit=200_000_000):
    if urlparse(url).scheme != 'https' or urlparse(url).hostname not in ALLOWED_HOSTS:
        raise ValueError('元件來源不在官方來源清單內。')
    request=urllib.request.Request(url,headers={'User-Agent':'Huanyu-Downloader/1.1','Accept':'application/json'})
    with urllib.request.build_opener(OfficialRedirects()).open(request,timeout=30) as response:
        if urlparse(response.url).scheme != 'https' or urlparse(response.url).hostname not in ALLOWED_HOSTS:
            raise ValueError('下載轉址不在官方來源清單內。')
        data=response.read(limit+1)
    if len(data)>limit: raise ValueError('元件下載超出大小限制。')
    return data

def read_json(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default

def atomic(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(path)

def newer(remote, local):
    if not local:return True
    def parts(v):return tuple(int(x) for x in re.findall(r'\d+',v))
    return parts(remote)>parts(local)

def port_open(port):
    try:
        with socket.create_connection(('127.0.0.1',port),timeout=.25):return True
    except OSError:return False

def installed(root):
    import importlib.metadata as metadata
    versions={}
    for name in ('yt-dlp','yt-dlp-ejs'):
        try:
            versions[name]=metadata.version(name)
            probe=subprocess.run([sys.executable,'-c','import '+name.replace('-','_')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=8,creationflags=0x08000000 if os.name=='nt' else 0)
            if probe.returncode:versions[name]=None
        except Exception:versions[name]=None
    ff=root/'runtime/ffmpeg/bin/ffmpeg.exe'
    if not ff.exists():ff=Path(shutil.which('ffmpeg') or 'missing-ffmpeg')
    try:
        text=subprocess.check_output([str(ff),'-version'],timeout=5,creationflags=0x08000000 if os.name=='nt' else 0).decode(errors='replace')
        versions['ffmpeg']=re.search(r'ffmpeg version ([^\s]+)',text).group(1)
    except Exception:versions['ffmpeg']=None
    deno=root/'runtime/deno/deno.exe'
    try:versions['deno']=subprocess.check_output([str(deno),'--version'],timeout=5,creationflags=0x08000000 if os.name=='nt' else 0).decode().split()[1]
    except Exception:versions['deno']=None
    manifest=read_json(root/'wechat-channels/engine/manifest.json',{})
    exe=root/'wechat-channels/engine/wx_video_download.exe'
    valid=exe.exists() and hashlib.sha256(exe.read_bytes()).hexdigest()==manifest.get('executable_sha256')
    versions['wechat']=manifest.get('version') if valid else None
    return versions

def candidate(name):
    if name in ('yt-dlp','yt-dlp-ejs'):
        data=json.loads(fetch('https://pypi.org/pypi/'+name+'/json',10_000_000))
        asset=next(a for a in data['urls'] if a['filename'].endswith('py3-none-any.whl') and not a.get('yanked'))
        from pip._vendor.packaging.specifiers import SpecifierSet
        required=asset.get('requires_python') or data['info'].get('requires_python') or ''
        if required and not SpecifierSet(required).contains('.'.join(map(str,sys.version_info[:3]))):raise ValueError('新版本需要較新的 Python，請改用新版完整攜帶包。')
        return {'version':data['info']['version'],'url':asset['url'],'sha256':asset['digests']['sha256'],'size':asset['size']}
    repo={'wechat':'ltaoo/wx_channels_download','ffmpeg':'GyanD/codexffmpeg','deno':'denoland/deno'}[name]
    data=json.loads(fetch('https://api.github.com/repos/'+repo+'/releases/latest',2_000_000))
    if data.get('prerelease') or data.get('draft'):raise ValueError('不套用測試發布版本。')
    def matches(asset):
        n=asset['name']
        return (n.startswith('wx_video_download_safe_') and n.endswith('_windows_x86_64.zip')) if name=='wechat' else n=='deno-x86_64-pc-windows-msvc.zip' if name=='deno' else n.endswith('-essentials_build.zip')
    asset=next(a for a in data['assets'] if matches(a))
    digest=asset.get('digest') or ''
    if not re.fullmatch(r'sha256:[a-f0-9]{64}',digest):raise ValueError('發布來源未提供 SHA-256，無法安全更新。')
    return {'version':data['tag_name'],'url':asset['browser_download_url'],'sha256':digest[7:],'size':asset['size'],'asset':asset['name']}

def wheel_payload(archive, package):
    names=archive.namelist(); prefix=package.replace('-','_')
    roots={PurePosixPath(n).parts[0] for n in names if PurePosixPath(n).parts}
    selected={r for r in roots if r==prefix or (r.startswith(prefix+'-') and r.endswith('.dist-info'))}
    if prefix not in selected or not any(r.endswith('.dist-info') for r in selected):raise ValueError('元件封裝內容不完整。')
    return {n:archive.read(n) for n in names if PurePosixPath(n).parts[0] in selected and not n.endswith('/')}

def validate_paths(payload):
    for name,data in payload.items():
        parts=PurePosixPath(name).parts
        if not parts or '..' in parts or PurePosixPath(name).is_absolute() or '\\' in name or ':' in name:raise ValueError('元件包含不安全路徑。')
        if len(data)>250_000_000:raise ValueError('解壓檔案超出限制。')
    if sum(map(len,payload.values()))>700_000_000:raise ValueError('解壓元件超出限制。')

def stage(root, name, release, blob):
    if hashlib.sha256(blob).hexdigest()!=release['sha256']:raise ValueError('SHA-256 校驗失敗，原元件未變更。')
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        if sum(a.file_size for a in archive.infolist())>700_000_000:raise ValueError('封裝解壓大小超出限制。')
        if name in ('yt-dlp','yt-dlp-ejs'):
            payload=wheel_payload(archive,name); base='runtime/Lib/site-packages'
        elif name=='deno':
            exe=archive.read('deno.exe')
            if not exe.startswith(b'MZ'):raise ValueError('Deno 執行檔格式不符。')
            payload={'deno.exe':exe};base='runtime/deno'
        elif name=='wechat':
            exe=archive.read('wx_video_download.exe')
            if not exe.startswith(b'MZ'):raise ValueError('微信引擎不是 Windows 執行檔。')
            manifest={'repository':'https://github.com/ltaoo/wx_channels_download','version':release['version'],'tag':release['version'],**release,'executable_sha256':hashlib.sha256(exe).hexdigest()}
            payload={'wx_video_download.exe':exe,'LICENSE.upstream.txt':archive.read('LICENSE'),'manifest.json':json.dumps(manifest,ensure_ascii=False,indent=2).encode()};base='wechat-channels/engine'
        else:
            payload={}
            for target in ('ffmpeg.exe','ffprobe.exe'):
                entry=next(n for n in archive.namelist() if n.endswith('/bin/'+target)); value=archive.read(entry)
                if not value.startswith(b'MZ'):raise ValueError('FFmpeg 執行檔格式不符。')
                payload['bin/'+target]=value
            license_entry=next(n for n in archive.namelist() if PurePosixPath(n).name.upper() in ('LICENSE','LICENSE.TXT'))
            payload['LICENSE.txt']=archive.read(license_entry);base='runtime/ffmpeg'
    validate_paths(payload)
    pending=root/'data/component-updates'/name
    if pending.exists():raise ValueError('此元件已暫存更新，請先重新啟動。')
    work=root/'data/component-updates'/('stage-'+uuid.uuid4().hex)
    work.mkdir(parents=True)
    for rel,value in payload.items():
        path=work/'payload'/rel;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(value)
    roots=sorted({PurePosixPath(n).parts[0] for n in payload})
    atomic(work/'update.json',{'id':name,'version':release['version'],'base':base,'roots':roots,'files':{n:hashlib.sha256(v).hexdigest() for n,v in payload.items()}})
    work.rename(pending)

def apply_pending(root):
    parent=root/'data/component-updates';messages=[]
    for name in LABELS:
        folder=parent/name
        if not folder.exists():continue
        if name=='wechat' and port_open(5031):messages.append('微信輔助工具仍開啟，微信引擎更新留待下次啟動。');continue
        spec=read_json(folder/'update.json')
        expected={'yt-dlp':'runtime/Lib/site-packages','yt-dlp-ejs':'runtime/Lib/site-packages','ffmpeg':'runtime/ffmpeg','wechat':'wechat-channels/engine','deno':'runtime/deno'}[name]
        if spec['id']!=name or spec['base']!=expected:raise ValueError('更新資訊不符。')
        validate_paths({n:b'' for n in spec['files']})
        if sorted({PurePosixPath(n).parts[0] for n in spec['files']})!=spec['roots']:raise ValueError('更新目錄不符。')
        for rel,digest in spec['files'].items():
            path=folder/'payload'/rel
            # Already moved paths from an interrupted apply are validated at destination.
            source=path if path.exists() else root/expected/rel
            if hashlib.sha256(source.read_bytes()).hexdigest()!=digest:raise ValueError('暫存更新校驗失敗，未套用更新。')
        journal=read_json(folder/'journal.json',[])
        obsolete=[]
        if name in ('yt-dlp','yt-dlp-ejs'):
            prefix=name.replace('-','_')+'-'
            for old in (root/expected).glob(prefix+'*.dist-info'):
                if old.name not in spec['roots']:
                    backup=folder/'obsolete'/old.name;backup.parent.mkdir(parents=True,exist_ok=True);old.rename(backup)
            obsolete=list((folder/'obsolete').glob('*'))
        try:
            for item in spec['roots']:
                if item in journal:continue
                dest=root/expected/item;source=folder/'payload'/item;backup=folder/'backup'/item
                backup.parent.mkdir(parents=True,exist_ok=True);dest.parent.mkdir(parents=True,exist_ok=True)
                if dest.exists() and not backup.exists():dest.rename(backup)
                if source.exists():source.rename(dest)
                journal.append(item);atomic(folder/'journal.json',journal)
            messages.append(LABELS[name]+' 已更新至 '+spec['version'])
            shutil.rmtree(folder)
        except Exception:
            for item in reversed(spec['roots']):
                dest=root/expected/item;source=folder/'payload'/item;backup=folder/'backup'/item
                if dest.exists() and not source.exists():source.parent.mkdir(parents=True,exist_ok=True);dest.rename(source)
                if backup.exists():backup.rename(dest)
            for old in obsolete:old.rename(root/expected/old.name)
            (folder/'journal.json').unlink(missing_ok=True)
            raise
    return messages

class Components:
    def __init__(self,root):
        self.root=Path(root);self.lock=threading.Lock();self.items=[];self.releases={};self.checked=False;self.busy=False;self.message='';self.checking=False
    def status(self):
        return {'items':self.items,'checked':self.checked,'checking':self.checking,'busy':self.busy,'message':self.message}
    def check(self):
        with self.lock:
            if self.checking or self.busy:return
            self.checking=True
        def work():
            rows=[];releases={}
            try:
                current=installed(self.root)
                for name,label in LABELS.items():
                    row={'id':name,'name':label,'current':current[name],'latest':None,'action':None,'error':None}
                    if (self.root/'data/component-updates'/name).exists():row['pending']=True
                    try:
                        release=candidate(name);releases[name]=release;row['latest']=release['version']
                        if not row.get('pending') and (not current[name] or newer(release['version'],current[name])):row['action']='repair' if not current[name] else 'update'
                    except Exception as e:row['error']='無法連線檢查：'+str(e)
                    rows.append(row)
                self.items,self.releases=rows,releases;self.checked=True;self.message='部分元件無法連線檢查，請連網後重試。缺少或損壞的元件所對應功能暫時無法使用。' if any(r['error'] and not r['current'] for r in rows) else '部分元件無法連線檢查。可稍後重試，現有元件仍可使用。' if any(r['error'] for r in rows) else '檢查完成；更新需經你確認。'
            except Exception as e:self.message='元件檢查失敗：'+str(e)
            finally:self.checking=False
        threading.Thread(target=work,daemon=True).start()
    def update(self,ids):
        with self.lock:
            if self.busy or self.checking:raise ValueError('元件檢查或更新進行中。')
            available={r['id'] for r in self.items if r.get('action') and not r.get('pending')}
            if any(name in ('yt-dlp','yt-dlp-ejs','ffmpeg','deno') for name in ids) and not (self.root/'runtime/python.exe').exists():raise ValueError('請使用完整攜帶版更新元件；原始碼模式不會修改系統 Python。')
            if not ids or len(ids)!=len(set(ids)) or not set(ids)<=available:raise ValueError('請選擇已檢查且可更新的元件。')
            self.busy=True
        def work():
            completed=[]
            try:
                for name in ids:
                    self.message='正在下載 '+LABELS[name]+'…'
                    release=self.releases[name];stage(self.root,name,release,fetch(release['url']))
                    completed.append(name)
                    for row in self.items:
                        if row['id']==name:row.update(pending=True,action=None)
                self.message='更新已校驗並暫存。請先結束微信輔助工具，再重新啟動主工具套用更新。'
            except Exception as e:self.message='更新未全部完成：'+str(e)+' 已完成的元件保留暫存；原元件未變更。'
            finally:self.busy=False
        threading.Thread(target=work,daemon=True).start()
