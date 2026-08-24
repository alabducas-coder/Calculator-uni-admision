/* Pruebas de la logica HL-4A en Linux (compila y ejecuta nativo) */
#include "hl4a_core.h"
#include <assert.h>

static char ascii[64];
static const char* D(void){
    wchar_t w[16]; hl4a_display_text(w,16);
    int i=0; for(;w[i];i++) ascii[i]=(char)w[i]; ascii[i]=0;
    return ascii;
}
static void type(const char*s){
    for(const char*p=s;*p;p++){
        if(*p>='0'&&*p<='9') key_digit(*p-'0');
        else switch(*p){
            case '.': key_dot();break;
            case '+': key_op('+');break;
            case '-': key_op('-');break;
            case '*': key_op('*');break;
            case '/': key_op('/');break;
            case '=': key_eq();break;
            case '%': key_pct();break;
            case 'q': key_sqrt();break;
            case 's': key_sign();break;
            case 'M': key_mplus(1);break;
            case 'm': key_mplus(-1);break;
            case 'r': key_mrc();break;
            case 'c': key_c();break;
            case 'a': key_ac();break;
            case 'o': calc_off();break;
        }
    }
}
static int fails=0;
static void expect(const char*expr,const char*want){
    const char*got=D();
    if(strcmp(got,want)!=0){ printf("FAIL %-22s got=%s want=%s\n",expr,got,want); fails++; }
    else printf("ok   %-22s -> %s\n",expr,got);
}
int main(void){
    calc_reset();
    expect("inicio","0");
    type("12+7=");      expect("12+7=","19");
    type("0.1+0.2=");   expect("0.1+0.2=","0.3");
    type("a200+10%=");  expect("200+10%=","220");
    type("a200*10%");   expect("200*10%","20");
    type("a9/3=");      expect("9/3=","3");
    type("=");          expect("= repite","1");
    type("a5/0=");      expect("5/0=","E");
    type("a");          expect("AC","0");
    type("16q");        expect("sqrt(16)","4");
    type("a2s");        expect("-2","-2");
    type("*3=");        expect("-2*3=","-6");
    type("a123456789"); expect("8 digitos max","12345678");
    type("a99999999+1=");expect("overflow","E");
    type("a5M3Mr");     expect("mem 5+3","8");
    type("r");          expect("MRC limpia","0");
    type("100-10%=");   expect("100-10%=","90");
    type("a50%");       expect("50%","0.5");
    type("a2+3c=");     expect("C borra entrada","2");
    type("o");          expect("OFF","");
    type("a");          expect("ON","0");
    printf(fails? "\n%d FALLOS\n":"\nTODO OK\n", fails);
    return fails?1:0;
}
