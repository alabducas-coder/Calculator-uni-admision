/* ============================================================================
 * Calculadora CASIO HL-4A  (emulador de escritorio para Windows)
 * ----------------------------------------------------------------------------
 * Emulacion fiel de la calculadora de bolsillo CASIO HL-4A (8 digitos):
 *   - Display LCD de 7 segmentos con indicadores MINUS y MEMORY
 *   - Teclado: MRC M- M+ sqrt OFF / AC C +/- % / 7 8 9 div / 4 5 6 x / 1 2 3 - / 0 . = +
 *   - Logica de ejecucion inmediata, memoria, porcentaje, raiz, errores (E)
 *
 * Compilacion cruzada desde Linux con zig:
 *   zig cc -target x86_64-windows-gnu -O2 -municode -o "Calculadora HL-4A.exe" hl4a_win.c -luser32 -lgdi32
 *   zig cc -target x86-windows-gnu    -O2 -municode -o "Calculadora HL-4A-x86.exe" hl4a_win.c -luser32 -lgdi32
 * ========================================================================== */
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "hl4a_core.h"

/* =========================================================================
 *  Interfaz grafica (GDI puro)
 * ======================================================================= */
#define CW 380
#define CH 600

static HWND hwndMain;
static int pressedKey=-1;

enum{ K_MRC,K_MMIN,K_MPL,K_SQ,K_OFF, K_AC,K_C,K_SIGN,K_PCT,
      K_7,K_8,K_9,K_DIV, K_4,K_5,K_6,K_MUL, K_1,K_2,K_3,K_SUB,
      K_0,K_DOT,K_EQ,K_ADD };

typedef struct{ RECT r; const wchar_t*label; int id; } Key;
static Key keys[29];
static int nkeys=0;

static void add_key(int x,int y,int w,int h,const wchar_t*l,int id){
    Key k; k.r.left=x;k.r.top=y;k.r.right=x+w;k.r.bottom=y+h;
    k.label=l; k.id=id;
    keys[nkeys++]=k;
}
static void build_layout(void){
    nkeys=0;
    int mx=20, gap=8;
    int y=214, h=36;
    int w5=(CW-2*mx-4*gap)/5;
    add_key(mx,             y,w5,h,L"MRC",K_MRC);
    add_key(mx+1*(w5+gap),  y,w5,h,L"M-",K_MMIN);
    add_key(mx+2*(w5+gap),  y,w5,h,L"M+",K_MPL);
    add_key(mx+3*(w5+gap),  y,w5,h,L"\x221A",K_SQ);
    add_key(mx+4*(w5+gap),  y,w5+ (CW-2*mx-5*w5-4*gap),h,L"OFF",K_OFF);
    int w4=(CW-2*mx-3*10)/4; int y0=260, hh=54, gv=10;
    const wchar_t*rows[5][4]={
        {L"AC",L"C",L"+/-",L"%"},
        {L"7",L"8",L"9",L"\x00F7"},
        {L"4",L"5",L"6",L"\x00D7"},
        {L"1",L"2",L"3",L"\x2212"},
        {L"0",L"\x2022",L"=",L"+"},
    };
    int ids[5][4]={
        {K_AC,K_C,K_SIGN,K_PCT},
        {K_7,K_8,K_9,K_DIV},
        {K_4,K_5,K_6,K_MUL},
        {K_1,K_2,K_3,K_SUB},
        {K_0,K_DOT,K_EQ,K_ADD},
    };
    for(int r=0;r<5;r++)
        for(int c=0;c<4;c++)
            add_key(mx+c*(w4+10), y0+r*(hh+gv), w4, hh, rows[r][c], ids[r][c]);
}

static COLORREF col_lcd    = 0x00D8E2D6;
static COLORREF col_seg    = 0x00141414;
static COLORREF col_ghost  = 0x00BFC8BA;
static COLORREF col_txt    = 0x00F0F0F0;

static HBRUSH br_body;
static HFONT f_brand,f_sub,f_key,f_ind;

static void make_gdi(void){
    br_body =CreateSolidBrush(0x00534B47);
    f_brand=CreateFontW(-24,0,0,0,FW_BOLD,FALSE,FALSE,FALSE,DEFAULT_CHARSET,
             OUT_TT_ONLY_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH,L"Segoe UI");
    f_sub  =CreateFontW(-12,0,0,0,FW_NORMAL,FALSE,FALSE,FALSE,DEFAULT_CHARSET,
             OUT_TT_ONLY_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH,L"Segoe UI");
    f_key  =CreateFontW(-20,0,0,0,FW_SEMIBOLD,FALSE,FALSE,FALSE,DEFAULT_CHARSET,
             OUT_TT_ONLY_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH,L"Segoe UI");
    f_ind  =CreateFontW(-11,0,0,0,FW_BOLD,FALSE,FALSE,FALSE,DEFAULT_CHARSET,
             OUT_TT_ONLY_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH,L"Segoe UI");
}

/* ---------- dibujo de 7 segmentos ---------- */
static void seg_poly(HDC hdc, const POINT*pts,int n){
    BeginPath(hdc);
    Polygon(hdc,(POINT*)pts,n);
    EndPath(hdc);
    StrokeAndFillPath(hdc);
}
static void draw_digit(HDC hdc,int x,int y,int w,int h,wchar_t ch){
    int t=h/7; if(t<3)t=3;
    int t2=t/2;
    int segs=0; /* bits: A1 B2 C4 D8 E16 F32 G64 */
    switch(ch){
        case '0': segs=0x3F;break;
        case '1': segs=0x06;break;
        case '2': segs=0x5B;break;
        case '3': segs=0x4F;break;
        case '4': segs=0x66;break;
        case '5': segs=0x6D;break;
        case '6': segs=0x7D;break;
        case '7': segs=0x07;break;
        case '8': segs=0x7F;break;
        case '9': segs=0x6F;break;
        case '-': segs=0x40;break;
        case 'E': segs=0x79;break;
        default:  segs=0x00;break;
    }
    int ym=y+h/2;
    POINT A[6]={{x+t2,y},{x+w-t2,y},{x+w-t,y+t2},{x+w-t2,y+t},{x+t2,y+t},{x+t,y+t2}};
    POINT G[6]={{x+t,ym-t2},{x+t2,ym},{x+t,ym+t2},{x+w-t,ym+t2},{x+w-t2,ym},{x+w-t,ym-t2}};
    POINT D[6]={{x+t2,y+h},{x+w-t2,y+h},{x+w-t,y+h-t2},{x+w-t2,y+h-t},{x+t2,y+h-t},{x+t,y+h-t2}};
    POINT F[6]={{x+t,y+t2},{x+t2,y+t},{x+t2,ym-t2},{x+t,ym-t},{x,ym-t2},{x,y+t2}};
    POINT B[6]={{x+w-t,y+t2},{x+w,y+t2},{x+w,ym-t2},{x+w-t,ym-t},{x+w-t2,ym-t2},{x+w-t2,y+t}};
    POINT E[6]={{x+t,ym+t2},{x+t2,ym+t},{x+t2,y+h-t},{x+t,y+h-t2},{x,y+h-t2},{x,ym+t2}};
    POINT C[6]={{x+w-t,ym+t2},{x+w,ym+t2},{x+w,y+h-t2},{x+w-t,y+h-t2},{x+w-t2,y+h-t},{x+w-t2,ym+t}};
    HBRUSH old=(HBRUSH)SelectObject(hdc,GetStockObject(DC_BRUSH));
    SetDCBrushColor(hdc,col_seg);
    HPEN op_=(HPEN)SelectObject(hdc,GetStockObject(NULL_PEN));
    if(segs&0x01) seg_poly(hdc,A,6);
    if(segs&0x02) seg_poly(hdc,B,6);
    if(segs&0x04) seg_poly(hdc,C,6);
    if(segs&0x08) seg_poly(hdc,D,6);
    if(segs&0x10) seg_poly(hdc,E,6);
    if(segs&0x20) seg_poly(hdc,F,6);
    if(segs&0x40) seg_poly(hdc,G,6);
    SelectObject(hdc,old);
    SelectObject(hdc,op_);
}

static void draw_text(HDC hdc,int x,int y,int hh,int w,const wchar_t*s,COLORREF c,HFONT f,int center){
    SetBkMode(hdc,TRANSPARENT);
    SetTextColor(hdc,c);
    HFONT of=(HFONT)SelectObject(hdc,f);
    RECT r={x,y,x+w,y+hh};
    UINT fl=DT_SINGLELINE|DT_VCENTER|DT_NOPREFIX|(center?DT_CENTER:DT_LEFT);
    DrawTextW(hdc,s,-1,&r,fl);
    SelectObject(hdc,of);
}

static void paint(HDC hdc){
    RECT rc; GetClientRect(hwndMain,&rc);
    FillRect(hdc,&rc,br_body);
    draw_text(hdc,0,12,26,CW,L"CASIO",0x00EDEDF2,f_brand,1);
    draw_text(hdc,0,42,16,CW,L"ELECTRONIC CALCULATOR",0x00B9B3BF,f_sub,1);
    draw_text(hdc,58,58,16,CW-116,L"HL-4A",0x00C9C3CF,f_sub,1);

    HBRUSH ob=(HBRUSH)SelectObject(hdc,GetStockObject(DC_BRUSH));
    HPEN open_= (HPEN)SelectObject(hdc,GetStockObject(NULL_PEN));
    SetDCBrushColor(hdc,0x003B3542);
    RoundRect(hdc,18,84,CW-18,198,14,14);
    SetDCBrushColor(hdc,col_lcd);
    RoundRect(hdc,28,94,CW-28,188,8,8);
    SelectObject(hdc,ob); SelectObject(hdc,open_);

    int minusOn = g.power && shown_value()<0;
    int memOn   = g.power && g.mem!=0;
    draw_text(hdc,40,100,16,16,L"-", minusOn?col_seg:col_ghost,f_ind,0);
    draw_text(hdc,58,100,16,64,L"MINUS", (g.power&&minusOn)?col_seg:col_ghost,f_ind,0);
    draw_text(hdc,140,100,16,76,L"MEMORY", (g.power&&memOn)?col_seg:col_ghost,f_ind,0);

    wchar_t disp[16];
    if(!g.power){ disp[0]=0; }
    else if(g.err){ wcscpy(disp,L"E"); }
    else if(g.entering){
        int i=0; if(g.negEntry) disp[i++]='-';
        for(const wchar_t*p=g.entry;*p && i<14;p++) disp[i++]=*p;
        disp[i]=0;
    }else{
        if(!fmt_number(g.cur,disp,16)) wcscpy(disp,L"E");
    }
    int cw=27, chh=46, dotw=10, gap=3;
    int x=CW-28-6;
    int yb=130;
    for(int i=(int)wcslen(disp)-1;i>=0;i--){
        wchar_t c=disp[i];
        if(c=='.'){
            x-=dotw;
            HBRUSH o2=(HBRUSH)SelectObject(hdc,GetStockObject(DC_BRUSH));
            SetDCBrushColor(hdc,col_seg);
            HPEN o3=(HPEN)SelectObject(hdc,GetStockObject(NULL_PEN));
            Rectangle(hdc,x+2,yb+chh-6,x+8,yb+chh);
            SelectObject(hdc,o2);SelectObject(hdc,o3);
        }else{
            x-=cw; draw_digit(hdc,x,yb,cw,chh,c); x-=gap;
        }
    }

    for(int i=0;i<nkeys;i++){
        Key*k=&keys[i];
        int red = (k->id==K_AC||k->id==K_C);
        int pressed = (i==pressedKey);
        HBRUSH o4=(HBRUSH)SelectObject(hdc,GetStockObject(DC_BRUSH));
        HPEN o5=(HPEN)SelectObject(hdc,GetStockObject(NULL_PEN));
        SetDCBrushColor(hdc,0x00201D24);
        RoundRect(hdc,k->r.left,k->r.top+2,k->r.right,k->r.bottom+2,10,10);
        SetDCBrushColor(hdc, red? (pressed?0x007E6BB0:0x006E5BA0)
                                : (pressed?0x004A4540:0x002E2B28));
        RoundRect(hdc,k->r.left,k->r.top,k->r.right,k->r.bottom,10,10);
        SelectObject(hdc,o4);SelectObject(hdc,o5);
        RECT tr=k->r; if(pressed) tr.top+=1;
        draw_text(hdc,tr.left,tr.top,tr.bottom-tr.top,tr.right-tr.left,k->label,col_txt,f_key,1);
    }
}

static void do_key(int id){
    switch(id){
        case K_0:key_digit(0);break; case K_1:key_digit(1);break;
        case K_2:key_digit(2);break; case K_3:key_digit(3);break;
        case K_4:key_digit(4);break; case K_5:key_digit(5);break;
        case K_6:key_digit(6);break; case K_7:key_digit(7);break;
        case K_8:key_digit(8);break; case K_9:key_digit(9);break;
        case K_DOT:key_dot();break;
        case K_ADD:key_op('+');break; case K_SUB:key_op('-');break;
        case K_MUL:key_op('*');break; case K_DIV:key_op('/');break;
        case K_EQ:key_eq();break;
        case K_AC:key_ac();break; case K_C:key_c();break;
        case K_SIGN:key_sign();break; case K_PCT:key_pct();break;
        case K_SQ:key_sqrt();break;
        case K_MPL:key_mplus(1);break; case K_MMIN:key_mplus(-1);break;
        case K_MRC:key_mrc();break;
        case K_OFF:calc_off();break;
    }
}

static int hit_key(int x,int y){
    for(int i=0;i<nkeys;i++){
        Key*k=&keys[i];
        if(x>=k->r.left&&x<=k->r.right&&y>=k->r.top&&y<=k->r.bottom) return i;
    }
    return -1;
}

static LRESULT CALLBACK WndProc(HWND h,UINT m,WPARAM w,LPARAM l){
    switch(m){
        case WM_CREATE: hwndMain=h; build_layout(); return 0;
        case WM_PAINT:{
            PAINTSTRUCT ps; HDC hdc=BeginPaint(h,&ps);
            HDC mem=CreateCompatibleDC(hdc);
            RECT rc; GetClientRect(h,&rc);
            HBITMAP bmp=CreateCompatibleBitmap(hdc,rc.right,rc.bottom);
            HBITMAP ob=(HBITMAP)SelectObject(mem,bmp);
            paint(mem);
            BitBlt(hdc,0,0,rc.right,rc.bottom,mem,0,0,SRCCOPY);
            SelectObject(mem,ob); DeleteObject(bmp); DeleteDC(mem);
            EndPaint(h,&ps); return 0;
        }
        case WM_ERASEBKGND: return 1;
        case WM_LBUTTONDOWN:{
            int x=LOWORD(l),y=HIWORD(l);
            int i=hit_key(x,y);
            if(i>=0){ pressedKey=i; SetCapture(h); InvalidateRect(h,NULL,FALSE); }
            return 0;
        }
        case WM_LBUTTONUP:{
            int x=LOWORD(l),y=HIWORD(l);
            if(pressedKey>=0){
                ReleaseCapture();
                int i=hit_key(x,y);
                int id=keys[pressedKey].id;
                pressedKey=-1;
                if(i>=0) do_key(id);
                InvalidateRect(h,NULL,FALSE);
            }
            return 0;
        }
        case WM_CHAR:{
            wchar_t c=(wchar_t)w;
            if(c>='0'&&c<='9') do_key(K_0+(c-'0'));
            else switch(c){
                case '.': case ',': do_key(K_DOT);break;
                case '+': do_key(K_ADD);break;
                case '-': do_key(K_SUB);break;
                case '*': do_key(K_MUL);break;
                case '/': do_key(K_DIV);break;
                case '=': do_key(K_EQ);break;
                case '%': do_key(K_PCT);break;
                case 'r': case 'R': do_key(K_SQ);break;
                default: return 0;
            }
            InvalidateRect(h,NULL,FALSE);
            return 0;
        }
        case WM_KEYDOWN:{
            switch(w){
                case VK_RETURN: do_key(K_EQ);break;
                case VK_ESCAPE: do_key(K_AC);break;
                case VK_BACK: case VK_DELETE: do_key(K_C);break;
                case VK_DECIMAL: do_key(K_DOT);break;
                case VK_ADD: do_key(K_ADD);break;
                case VK_SUBTRACT: do_key(K_SUB);break;
                case VK_MULTIPLY: do_key(K_MUL);break;
                case VK_DIVIDE: do_key(K_DIV);break;
                case VK_NUMPAD0: do_key(K_0);break; case VK_NUMPAD1: do_key(K_1);break;
                case VK_NUMPAD2: do_key(K_2);break; case VK_NUMPAD3: do_key(K_3);break;
                case VK_NUMPAD4: do_key(K_4);break; case VK_NUMPAD5: do_key(K_5);break;
                case VK_NUMPAD6: do_key(K_6);break; case VK_NUMPAD7: do_key(K_7);break;
                case VK_NUMPAD8: do_key(K_8);break; case VK_NUMPAD9: do_key(K_9);break;
                default: return 0;
            }
            InvalidateRect(h,NULL,FALSE);
            return 0;
        }
        case WM_CLOSE: DestroyWindow(h); return 0;
        case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProcW(h,m,w,l);
}

int WINAPI wWinMain(HINSTANCE hi,HINSTANCE prev,LPWSTR cmd,int ns){
    (void)prev;(void)cmd;
    SetProcessDPIAware();
    calc_reset();
    WNDCLASSW wc; memset(&wc,0,sizeof wc);
    wc.lpfnWndProc=WndProc; wc.hInstance=hi;
    wc.lpszClassName=L"CasioHL4A";
    wc.hCursor=LoadCursorW(NULL,(LPCWSTR)IDC_ARROW);
    wc.hbrBackground=NULL;
    wc.hIcon=LoadIconW(hi,L"HL4AICON");
    make_gdi();
    RegisterClassW(&wc);
    int w=CW, hgt=CH;
    int sx=(GetSystemMetrics(SM_CXSCREEN)-w)/2;
    int sy=(GetSystemMetrics(SM_CYSCREEN)-hgt)/2;
    DWORD st=WS_OVERLAPPED|WS_CAPTION|WS_SYSMENU|WS_MINIMIZEBOX;
    RECT wr={0,0,w,hgt};
    AdjustWindowRect(&wr,st,FALSE);
    HWND hw=CreateWindowW(L"CasioHL4A",L"Calculadora CASIO HL-4A",st,sx,sy,
        wr.right-wr.left,wr.bottom-wr.top,NULL,NULL,hi,NULL);
    hwndMain=hw;
    ShowWindow(hw,ns);
    UpdateWindow(hw);
    MSG msg;
    while(GetMessageW(&msg,NULL,0,0)>0){
        TranslateMessage(&msg); DispatchMessageW(&msg);
    }
    return (int)msg.wParam;
}
