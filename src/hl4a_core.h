/* ============================================================================
 * hl4a_core.h - logica de la calculadora CASIO HL-4A (sin dependencias)
 * Compartida por el emulador Windows (hl4a_win.c) y las pruebas/herramientas.
 * ========================================================================== */
#ifndef HL4A_CORE_H
#define HL4A_CORE_H
#include <math.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#ifndef wchar_t_lite
#include <wchar.h>
#endif
/* ----------------------------- estado ----------------------------------- */
typedef struct {
    int    power;      /* encendida                       */
    int    err;        /* estado de error (E)             */
    double acc;        /* acumulador / operando izq.      */
    wchar_t op;        /* operacion pendiente 0 + - * /   */
    double cur;        /* valor mostrado (no entrando)    */
    int    entering;   /* tecleando numero                */
    wchar_t entry[12]; /* buffer de entrada               */
    int    negEntry;   /* signo de la entrada             */
    double mem;        /* memoria                         */
    int    justEq;     /* se pulso = por ultima vez       */
    double lastB;      /* ultimo operando B (repetir =)   */
    wchar_t lastOp;    /* ultima operacion (repetir =)    */
    int    mrcArmed;   /* MRC pulso 1 = MR, pulso 2 = MC  */
} Calc;

static Calc g;

static void calc_reset(void){
    int mem_keep = 0; (void)mem_keep;
    g.power=1; g.err=0; g.acc=0; g.op=0; g.cur=0;
    g.entering=0; g.entry[0]=0; g.negEntry=0;
    g.justEq=0; g.lastB=0; g.lastOp=0; g.mrcArmed=0;
}
static void calc_off(void){ g.power=0; }

static int entry_digits(void){
    int n=0; for(const wchar_t*p=g.entry;*p;p++) if(*p!='.'&&*p!='-') n++;
    return n;
}
static double entry_value(void){
    if(!g.entering) return g.cur;
    char buf[16]; int i=0;
    if(g.negEntry) buf[i++]='-';
    for(const wchar_t*p=g.entry;*p && i<14;p++) buf[i++]=(char)*p;
    buf[i]=0; return atof(buf);
}
static double shown_value(void){ return g.entering? entry_value() : g.cur; }

/* formatea con hasta 8 digitos; devuelve 0 si desborda */
static int fmt_number(double v, wchar_t *buf, int n){
    if(!isfinite(v)) return 0;
    double a=fabs(v);
    if(a>=99999999.5) return 0;
    int decimals;
    if(a>=1.0){
        int intd=(int)floor(log10(a))+1;
        decimals=8-intd; if(decimals<0) decimals=0;
    } else decimals=8;
    char tmp[32];
    snprintf(tmp,sizeof tmp,"%.*f",decimals,a);
    if(strchr(tmp,'.')){
        int L=(int)strlen(tmp);
        while(L>0 && tmp[L-1]=='0') tmp[--L]=0;
        if(L>0 && tmp[L-1]=='.') tmp[--L]=0;
    }
    int dg=0; for(char*p=tmp;*p;p++) if(*p>='0'&&*p<='9') dg++;
    if(dg>8) return 0;
    int i=0;
    if(v<-1e-9 && atof(tmp)!=0) buf[i++]='-';
    for(char*p=tmp;*p && i<n-1;p++) buf[i++]=(wchar_t)(unsigned char)*p;
    buf[i]=0; return 1;
}

static void set_error(void){ g.err=1; g.entering=0; g.op=0; }

static double apply(double a, wchar_t op, double b){
    switch(op){
        case '+': return a+b;
        case '-': return a-b;
        case '*': return a*b;
        case '/': return b==0? HUGE_VAL : a/b;
    }
    return b;
}
static int store_result(double r){
    if(!isfinite(r)||fabs(r)>=99999999.5){ set_error(); return 0; }
    wchar_t tmp[16];
    if(!fmt_number(r,tmp,16)){ set_error(); return 0; }
    char nb[32]; int i=0;
    for(wchar_t*p=tmp;*p;p++) nb[i++]=(char)*p; nb[i]=0;
    g.cur=atof(nb);
    return 1;
}

/* ----------------------------- teclas ----------------------------------- */
static void key_digit(int d){
    if(!g.power||g.err) return;
    g.mrcArmed=0;
    if(g.entering){
        if(entry_digits()>=8) return;
        int L=(int)wcslen(g.entry);
        g.entry[L]=(wchar_t)('0'+d); g.entry[L+1]=0;
    }else{
        g.entering=1; g.negEntry=0;
        g.entry[0]=(wchar_t)('0'+d); g.entry[1]=0;
        if(g.justEq){ g.op=0; g.lastOp=0; g.justEq=0; }
    }
}
static void key_dot(void){
    if(!g.power||g.err) return;
    g.mrcArmed=0;
    if(g.entering){
        if(wcschr(g.entry,'.')) return;
        if(entry_digits()>=8) return;
        int L=(int)wcslen(g.entry);
        g.entry[L]='.'; g.entry[L+1]=0;
    }else{
        g.entering=1; g.negEntry=0;
        wcscpy(g.entry,L"0.");
        if(g.justEq){ g.op=0; g.lastOp=0; g.justEq=0; }
    }
}
static void key_sign(void){
    if(!g.power||g.err) return;
    if(g.entering){ if(wcscmp(g.entry,L"0")!=0) g.negEntry=!g.negEntry; }
    else g.cur=-g.cur;
}
static void key_op(wchar_t op){
    if(!g.power||g.err) return;
    g.mrcArmed=0; g.justEq=0;
    if(g.entering){
        double v=entry_value();
        if(g.op){ double r=apply(g.acc,g.op,v); if(!store_result(r)) return; g.acc=g.cur; }
        else g.acc=v;
        g.entering=0;
    }else if(g.op==0){
        g.acc=g.cur;
    }
    g.op=op;
}
static void key_eq(void){
    if(!g.power||g.err) return;
    g.mrcArmed=0;
    if(g.op){
        double b=g.entering? entry_value() : g.cur;
        double r=apply(g.acc,g.op,b);
        g.lastB=b; g.lastOp=g.op; g.op=0; g.entering=0;
        if(!store_result(r)) return;
        g.justEq=1;
    }else if(g.justEq && g.lastOp){
        double r=apply(g.cur,g.lastOp,g.lastB);
        if(!store_result(r)) return;
    }
}
static void key_pct(void){
    if(!g.power||g.err) return;
    double v=shown_value();
    g.entering=0; g.justEq=0;
    if(g.op=='+'||g.op=='-'){
        double term=fabs(g.acc*v/100.0);
        if(!store_result(term)) return;
    }else if(g.op=='*'){
        double r=g.acc*v/100.0; g.op=0;
        if(!store_result(r)) return;
    }else if(g.op=='/'){
        double d2=v/100.0;
        if(d2==0){ set_error(); return; }
        double r=g.acc/d2; g.op=0;
        if(!store_result(r)) return;
    }else{
        if(!store_result(v/100.0)) return;
    }
}
static void key_sqrt(void){
    if(!g.power||g.err) return;
    double v=shown_value();
    if(v<0){ set_error(); return; }
    g.entering=0; g.justEq=0;
    store_result(sqrt(v));
}
static void key_mplus(int sign){
    if(!g.power||g.err) return;
    double v=shown_value();
    g.mem+=sign*v;
    if(fabs(g.mem)>=99999999.5) g.mem=(sign>0?99999999.0:-99999999.0);
    g.entering=0; g.justEq=0; g.mrcArmed=0;
}
static void key_mrc(void){
    if(!g.power||g.err) return;
    if(g.mrcArmed){ g.mem=0; g.cur=0; g.mrcArmed=0; }
    else{ g.entering=0; g.cur=g.mem; g.justEq=0; g.mrcArmed=1; }
}
static void key_c(void){
    if(!g.power) return;
    g.err=0; g.entering=0; g.entry[0]=0; g.negEntry=0; g.justEq=0; g.mrcArmed=0;
}
static void key_ac(void){
    double m=g.mem;
    memset(&g,0,sizeof g);
    g.mem=m; g.power=1;
}


/* cadena mostrada en el display (para pruebas y UI) */
static void hl4a_display_text(wchar_t *disp, int n){
    if(!g.power){ disp[0]=0; return; }
    if(g.err){ wcscpy(disp,L"E"); return; }
    if(g.entering){
        int i=0; if(g.negEntry) disp[i++]='-';
        for(const wchar_t*p=g.entry;*p && i<n-2;p++) disp[i++]=*p;
        disp[i]=0; return;
    }
    if(!fmt_number(g.cur,disp,n)) wcscpy(disp,L"E");
}
#endif /* HL4A_CORE_H */
