'use strict';

function El(Id) {
    return document.getElementById(Id);
}

function MakeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let ToastTimer = null;

function Toast(Message) {
    const Node = El('toast');
    if (!Node) return;
    Node.textContent = Message;
    Node.classList.remove('hidden');
    Node.classList.add('Show');
    clearTimeout(ToastTimer);
    ToastTimer = setTimeout(() => {
        Node.classList.remove('Show');
        setTimeout(() => Node.classList.add('hidden'), 220);
    }, 1600);
}

function CopyTextFallback(Text, Done) {
    const Area = document.createElement('textarea');
    Area.value = Text;
    Area.style.position = 'fixed';
    Area.style.opacity = '0';
    document.body.appendChild(Area);
    Area.select();
    try {
        document.execCommand('copy');
        Done();
    } catch (Error) {
        Toast('copy failed');
    }
    Area.remove();
}

function CopyText(Text) {
    const Value = String(Text === undefined || Text === null ? '' : Text);
    if (!Value) return;
    const Done = () => Toast('copied');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(Value).then(Done).catch(() => CopyTextFallback(Value, Done));
        return;
    }
    CopyTextFallback(Value, Done);
}

function Debounce(Fn, Delay) {
    let Timer = null;
    return function (...Args) {
        clearTimeout(Timer);
        Timer = setTimeout(() => Fn.apply(this, Args), Delay);
    };
}

const Store = {
    Prefix: 'revcalc.v2.',
    Get(Key, Fallback) {
        const Name = this.Prefix + Key;
        try {
            const Raw = localStorage.getItem(Name);
            if (Raw !== null) return JSON.parse(Raw);
        } catch (Error) {
        }
        const Cookie = Store.ReadCookie(Name);
        if (Cookie !== null) {
            try {
                return JSON.parse(Cookie);
            } catch (Error) {
            }
        }
        return Fallback;
    },
    Set(Key, Value) {
        const Name = this.Prefix + Key;
        let Raw = null;
        try {
            Raw = JSON.stringify(Value);
        } catch (Error) {
            return false;
        }
        try {
            localStorage.setItem(Name, Raw);
            return true;
        } catch (Error) {
        }
        return Store.WriteCookie(Name, Raw);
    },
    Delete(Key) {
        const Name = this.Prefix + Key;
        try {
            localStorage.removeItem(Name);
        } catch (Error) {
        }
        Store.WriteCookie(Name, '', -1);
    },
    ReadCookie(Name) {
        const Parts = document.cookie ? document.cookie.split('; ') : [];
        for (const Part of Parts) {
            const Index = Part.indexOf('=');
            if (Index === -1) continue;
            if (Part.slice(0, Index) === Name) {
                try {
                    return decodeURIComponent(Part.slice(Index + 1));
                } catch (Error) {
                    return null;
                }
            }
        }
        return null;
    },
    WriteCookie(Name, Value, MaxAge) {
        const Encoded = encodeURIComponent(String(Value));
        if (Encoded.length > 3800) return false;
        const Age = MaxAge === undefined ? 34560000 : MaxAge;
        document.cookie = Name + '=' + Encoded + ';max-age=' + Age + ';path=/;SameSite=Lax';
        return true;
    }
};

function PopCount(Value, Size) {
    let Remaining = BigInt.asUintN(Size, Value);
    let Count = 0;
    while (Remaining > 0n) {
        Count += Number(Remaining & 1n);
        Remaining >>= 1n;
    }
    return Count;
}

function CountLeadingZeros(Value, Size) {
    const Unsigned = BigInt.asUintN(Size, Value);
    if (Unsigned === 0n) return Size;
    return Size - Unsigned.toString(2).length;
}

function CountTrailingZeros(Value, Size) {
    const Unsigned = BigInt.asUintN(Size, Value);
    if (Unsigned === 0n) return Size;
    let Count = 0;
    let Current = Unsigned;
    while ((Current & 1n) === 0n) {
        Count += 1;
        Current >>= 1n;
    }
    return Count;
}

function ByteSwap(Value, Size) {
    const Unsigned = BigInt.asUintN(Size, Value);
    let Result = 0n;
    for (let Index = 0; Index < Size / 8; Index += 1) {
        Result = (Result << 8n) | ((Unsigned >> BigInt(Index * 8)) & 0xffn);
    }
    return BigInt.asIntN(Size, Result);
}

function ReverseBits(Value, Size) {
    const Unsigned = BigInt.asUintN(Size, Value);
    let Result = 0n;
    for (let Index = 0; Index < Size; Index += 1) {
        Result = (Result << 1n) | ((Unsigned >> BigInt(Index)) & 1n);
    }
    return BigInt.asIntN(Size, Result);
}

function BigIntPow(Base, Exponent, Size) {
    if (Exponent < 0n) throw new Error('negative exponent');
    if (Exponent > 8192n) throw new Error('exponent too large');
    let Result = 1n;
    let Current = BigInt.asIntN(Size, Base);
    let Remaining = Exponent;
    while (Remaining > 0n) {
        if (Remaining & 1n) Result = BigInt.asIntN(Size, Result * Current);
        Current = BigInt.asIntN(Size, Current * Current);
        Remaining >>= 1n;
    }
    return Result;
}

function GroupBinary(Bits, Group) {
    const Parts = [];
    for (let Index = 0; Index < Bits.length; Index += Group) {
        Parts.push(Bits.slice(Index, Index + Group));
    }
    return Parts.join(' ');
}

function EscapeBytes(Bytes) {
    return Bytes.map((Byte) => {
        if (Byte >= 0x20 && Byte <= 0x7e) {
            const Char = String.fromCharCode(Byte);
            if (Char === '\\') return '\\\\';
            return Char;
        }
        return '\\x' + Byte.toString(16).toUpperCase().padStart(2, '0');
    }).join('');
}

function FormatInt(Value, Size) {
    const Unsigned = BigInt.asUintN(Size, Value);
    const Signed = BigInt.asIntN(Size, Value);
    const HexDigits = Size / 4;
    const ByteCount = Size / 8;
    const Binary = Unsigned.toString(2).padStart(Size, '0');
    const Hex = Unsigned.toString(16).toUpperCase().padStart(HexDigits, '0');
    const Bytes = [];
    for (let Index = ByteCount - 1; Index >= 0; Index -= 1) {
        Bytes.push(Number((Unsigned >> BigInt(Index * 8)) & 0xffn));
    }
    const Reversed = Bytes.slice().reverse();
    return {
        Unsigned,
        Signed,
        SignedText: Signed.toString(),
        UnsignedText: Unsigned.toString(),
        Hex,
        HexText: '0x' + Hex,
        BinaryText: GroupBinary(Binary, 8),
        OctalText: '0o' + Unsigned.toString(8),
        BytesBe: Bytes,
        BytesLe: Reversed,
        AsciiBe: EscapeBytes(Bytes),
        AsciiLe: EscapeBytes(Reversed),
        PopCount: PopCount(Unsigned, Size),
        Clz: CountLeadingZeros(Unsigned, Size),
        Ctz: CountTrailingZeros(Unsigned, Size)
    };
}

function FormatFloat(Value) {
    const Buffer64 = new ArrayBuffer(8);
    const View64 = new DataView(Buffer64);
    View64.setFloat64(0, Value);
    const Bits64Value = View64.getBigUint64(0);
    const Bits64 = Bits64Value.toString(16).toUpperCase().padStart(16, '0');
    const Bytes = [];
    for (let Index = 0; Index < 8; Index += 1) {
        Bytes.push(Number((Bits64Value >> BigInt(56 - Index * 8)) & 0xffn));
    }
    const Buffer32 = new ArrayBuffer(4);
    const View32 = new DataView(Buffer32);
    View32.setFloat32(0, Value);
    const Bits32 = View32.getUint32(0).toString(16).toUpperCase().padStart(8, '0');
    let ClassName = 'normal';
    if (Number.isNaN(Value)) ClassName = 'nan';
    else if (!Number.isFinite(Value)) ClassName = 'infinity';
    else if (Value === 0) ClassName = 'zero';
    else if (Math.abs(Value) < 2.2250738585072014e-308) ClassName = 'subnormal';
    return {
        Bits64,
        Bits32,
        Bits64Text: '0x' + Bits64,
        Bits32Text: '0x' + Bits32,
        ExponentText: Number.isFinite(Value) ? Value.toExponential(8) : String(Value),
        BytesText: EscapeBytes(Bytes),
        ClassName,
        SignText: Object.is(Value, -0) || Value < 0 ? 'negative' : 'positive'
    };
}

function FormatFloatReadable(Value) {
    if (Number.isNaN(Value)) return 'NaN';
    if (Value === Infinity) return '+Inf';
    if (Value === -Infinity) return '-Inf';
    return String(Value);
}

function Float64FromBits(Bits) {
    const Buffer = new ArrayBuffer(8);
    const View = new DataView(Buffer);
    View.setBigUint64(0, Bits);
    return View.getFloat64(0);
}

function Float32FromBits(Bits) {
    const Buffer = new ArrayBuffer(4);
    const View = new DataView(Buffer);
    View.setUint32(0, Number(Bits & 0xffffffffn));
    return View.getFloat32(0);
}

const SinDegreeTable = [
    0, 0.5, Math.sqrt(3) / 2, 1,
    Math.sqrt(3) / 2, 0.5, 0, -0.5,
    -Math.sqrt(3) / 2, -1, -Math.sqrt(3) / 2, -0.5
];

function NormalizeDegrees(Angle) {
    return ((Angle % 360) + 360) % 360;
}

function SinDegrees(Angle) {
    const Normalized = NormalizeDegrees(Angle);
    if (Number.isInteger(Normalized) && Normalized % 30 === 0) {
        return SinDegreeTable[(Normalized / 30) % 12];
    }
    return Math.sin(Normalized * Math.PI / 180);
}

function CosDegrees(Angle) {
    return SinDegrees(Angle + 90);
}

function TanDegrees(Angle) {
    const Normalized = NormalizeDegrees(Angle);
    if (Number.isInteger(Normalized)) {
        if (Normalized === 90 || Normalized === 270) return Infinity;
        if (Normalized === 0 || Normalized === 180) return 0;
        if (Normalized === 45 || Normalized === 225) return 1;
        if (Normalized === 135 || Normalized === 315) return -1;
    }
    return Math.tan(Normalized * Math.PI / 180);
}

function CleanDegrees(Value) {
    const Rounded = Math.round(Value * 1e10) / 1e10;
    return Math.abs(Rounded - Value) < 1e-10 ? Rounded : Value;
}

const TokenRules = [
    { Type: 'Space', Re: /^\s+/ },
    { Type: 'Number', Re: /^0[xX][0-9a-fA-F_]+/ },
    { Type: 'Number', Re: /^0[bB][01_]+/ },
    { Type: 'Number', Re: /^0[oO][0-7_]+/ },
    { Type: 'Number', Re: /^(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?/ },
    { Type: 'Operator', Re: /^(?:>>>|>>|<<|\*\*|[+\-*/%&|^~(),])/ },
    { Type: 'Identifier', Re: /^[A-Za-z_][A-Za-z0-9_]*/ }
];

function TokenizeExpression(Source) {
    const Tokens = [];
    let Rest = Source;
    while (Rest.length > 0) {
        let Matched = false;
        for (const Rule of TokenRules) {
            const Match = Rule.Re.exec(Rest);
            if (!Match) continue;
            if (Rule.Type !== 'Space') Tokens.push({ Type: Rule.Type, Value: Match[0] });
            Rest = Rest.slice(Match[0].length);
            Matched = true;
            break;
        }
        if (!Matched) throw new Error('unexpected character "' + Rest[0] + '"');
    }
    return Tokens;
}

class ExpressionParser {
    constructor(Source, Options) {
        this.FloatMode = Options.Mode === 'float';
        this.Size = Options.Size || 64;
        this.Angle = Options.Angle || 'deg';
        this.Ans = Options.Ans;
        this.Tokens = TokenizeExpression(Source);
        this.Position = 0;
        this.Precedence = this.FloatMode
            ? { '|': 1, '&': 2, '<<': 3, '>>': 3, '>>>': 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5, '^': 6, '**': 6 }
            : { '|': 1, '^': 2, '&': 3, '<<': 4, '>>': 4, '>>>': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '**': 7 };
    }

    Parse() {
        if (this.Tokens.length === 0) throw new Error('empty expression');
        const Value = this.ParseExpression(0);
        if (this.Position < this.Tokens.length) {
            throw new Error('unexpected "' + this.Tokens[this.Position].Value + '"');
        }
        return Value;
    }

    Peek() {
        return this.Tokens[this.Position];
    }

    Consume() {
        return this.Tokens[this.Position++];
    }

    Wrap(Value) {
        return BigInt.asIntN(this.Size, Value);
    }

    ParseExpression(MinPrecedence) {
        let Left = this.ParseUnary();
        for (;;) {
            const Token = this.Peek();
            if (!Token || Token.Type !== 'Operator') break;
            const Operator = Token.Value;
            if (!(Operator in this.Precedence)) break;
            const Precedence = this.Precedence[Operator];
            if (Precedence < MinPrecedence) break;
            this.Consume();
            const RightAssociative = Operator === '**' || (this.FloatMode && Operator === '^');
            const NextMin = RightAssociative ? Precedence : Precedence + 1;
            Left = this.ApplyBinary(Operator, Left, this.ParseExpression(NextMin));
        }
        return Left;
    }

    ParseUnary() {
        const Token = this.Peek();
        if (Token && Token.Type === 'Operator' && (Token.Value === '-' || Token.Value === '+' || Token.Value === '~')) {
            this.Consume();
            return this.ApplyUnary(Token.Value, this.ParseUnary());
        }
        return this.ParsePrimary();
    }

    ParsePrimary() {
        const Token = this.Consume();
        if (!Token) throw new Error('unexpected end of expression');
        if (Token.Type === 'Number') return this.ParseNumber(Token.Value);
        if (Token.Type === 'Identifier') return this.ParseIdentifier(Token.Value);
        if (Token.Type === 'Operator' && Token.Value === '(') {
            const Value = this.ParseExpression(0);
            const Close = this.Consume();
            if (!Close || Close.Value !== ')') throw new Error('missing closing parenthesis');
            return Value;
        }
        throw new Error('unexpected "' + Token.Value + '"');
    }

    ParseNumber(Raw) {
        const Clean = Raw.replace(/_/g, '');
        if (this.FloatMode) {
            if (/^0[xXbBoO]/.test(Clean)) return Number(BigInt(Clean));
            return Number(Clean);
        }
        if (/[.eE]/.test(Clean)) throw new Error('integer mode: decimals are not allowed');
        return this.Wrap(BigInt(Clean));
    }

    ParseIdentifier(Name) {
        const Lower = Name.toLowerCase();
        if (Lower === 'ans') {
            if (this.FloatMode) return Number(this.Ans || 0);
            return this.Wrap(BigInt(this.Ans === undefined ? 0 : this.Ans));
        }
        const Next = this.Peek();
        if (Next && Next.Type === 'Operator' && Next.Value === '(') {
            this.Consume();
            const Args = [];
            if (this.Peek() && this.Peek().Value !== ')') {
                for (;;) {
                    Args.push(this.ParseExpression(0));
                    const Separator = this.Peek();
                    if (Separator && Separator.Value === ',') {
                        this.Consume();
                        continue;
                    }
                    break;
                }
            }
            const Close = this.Consume();
            if (!Close || Close.Value !== ')') throw new Error('missing ) after ' + Name);
            return this.CallFunction(Lower, Args);
        }
        if (this.FloatMode) {
            if (Lower === 'pi') return Math.PI;
            if (Lower === 'e') return Math.E;
            if (Lower === 'tau') return Math.PI * 2;
            if (Lower === 'inf' || Lower === 'infinity') return Infinity;
            throw new Error('unknown constant "' + Name + '"');
        }
        if (/^[0-9a-fA-F]+$/.test(Name)) return this.Wrap(BigInt('0x' + Name));
        throw new Error('unknown identifier "' + Name + '"');
    }

    CallFunction(Name, Args) {
        const First = Args[0];
        if (this.FloatMode) {
            const Deg = this.Angle === 'deg';
            switch (Name) {
                case 'sin': return Deg ? SinDegrees(First) : Math.sin(First);
                case 'cos': return Deg ? CosDegrees(First) : Math.cos(First);
                case 'tan': return Deg ? TanDegrees(First) : Math.tan(First);
                case 'asin': return Deg ? CleanDegrees(Math.asin(First) * 180 / Math.PI) : Math.asin(First);
                case 'acos': return Deg ? CleanDegrees(Math.acos(First) * 180 / Math.PI) : Math.acos(First);
                case 'atan': return Deg ? CleanDegrees(Math.atan(First) * 180 / Math.PI) : Math.atan(First);
                case 'atan2': return Deg ? CleanDegrees(Math.atan2(First, Args[1]) * 180 / Math.PI) : Math.atan2(First, Args[1]);
                case 'sqrt': return Math.sqrt(First);
                case 'cbrt': return Math.cbrt(First);
                case 'log': case 'log10': return Math.log10(First);
                case 'ln': return Math.log(First);
                case 'log2': return Math.log2(First);
                case 'exp': return Math.exp(First);
                case 'abs': return Math.abs(First);
                case 'floor': return Math.floor(First);
                case 'ceil': return Math.ceil(First);
                case 'round': return Math.round(First);
                case 'trunc': return Math.trunc(First);
                case 'pow': return Math.pow(First, Args[1]);
                case 'min': return Math.min(...Args);
                case 'max': return Math.max(...Args);
                default: throw new Error('unknown function "' + Name + '"');
            }
        }
        switch (Name) {
            case 'popcnt': return this.Wrap(BigInt(PopCount(First, this.Size)));
            case 'clz': return this.Wrap(BigInt(CountLeadingZeros(First, this.Size)));
            case 'ctz': return this.Wrap(BigInt(CountTrailingZeros(First, this.Size)));
            case 'bswap': return ByteSwap(First, this.Size);
            case 'rev': return ReverseBits(First, this.Size);
            case 'abs': return First < 0n ? this.Wrap(-First) : First;
            case 'neg': return this.Wrap(-First);
            case 'min': return First < Args[1] ? First : Args[1];
            case 'max': return First > Args[1] ? First : Args[1];
            default: throw new Error('unknown function "' + Name + '"');
        }
    }

    ApplyUnary(Operator, Value) {
        if (this.FloatMode) {
            if (Operator === '-') return -Value;
            if (Operator === '+') return Value;
            throw new Error('operator "' + Operator + '" needs integers');
        }
        if (Operator === '-') return this.Wrap(-Value);
        if (Operator === '+') return Value;
        if (Operator === '~') return this.Wrap(~Value);
        throw new Error('unknown unary operator "' + Operator + '"');
    }

    ApplyBinary(Operator, Left, Right) {
        if (this.FloatMode) {
            switch (Operator) {
                case '+': return Left + Right;
                case '-': return Left - Right;
                case '*': return Left * Right;
                case '/': return Left / Right;
                case '%': return Left % Right;
                case '^': case '**': return Math.pow(Left, Right);
                default: throw new Error('operator "' + Operator + '" needs integers');
            }
        }
        switch (Operator) {
            case '+': return this.Wrap(Left + Right);
            case '-': return this.Wrap(Left - Right);
            case '*': return this.Wrap(Left * Right);
            case '/':
                if (Right === 0n) throw new Error('division by zero');
                return this.Wrap(Left / Right);
            case '%':
                if (Right === 0n) throw new Error('modulo by zero');
                return this.Wrap(Left % Right);
            case '&': return this.Wrap(Left & Right);
            case '|': return this.Wrap(Left | Right);
            case '^': return this.Wrap(Left ^ Right);
            case '**': return BigIntPow(Left, Right, this.Size);
            case '<<': return this.ShiftLeft(Left, Right);
            case '>>': return this.ShiftRight(Left, Right, false);
            case '>>>': return this.ShiftRight(Left, Right, true);
            default: throw new Error('unknown operator "' + Operator + '"');
        }
    }

    ShiftLeft(Value, Amount) {
        if (Amount < 0n) throw new Error('negative shift');
        if (Amount > 8192n) throw new Error('shift too large');
        return this.Wrap(Value << Amount);
    }

    ShiftRight(Value, Amount, Logical) {
        if (Amount < 0n) throw new Error('negative shift');
        if (Amount > 8192n) throw new Error('shift too large');
        if (Logical) return this.Wrap(BigInt.asUintN(this.Size, Value) >> Amount);
        return this.Wrap(Value >> Amount);
    }
}

class CalculatorPanel {
    constructor() {
        this.ExprInput = El('expr-input');
        this.ResultBig = El('result-big');
        this.ResultStatus = El('result-status');
        this.WordSizeSelect = El('word-size');
        this.AngleButton = El('angle-toggle');
        this.IntPad = El('keypad-int');
        this.FloatPad = El('keypad-float');
        this.IntResult = El('int-result');
        this.FloatResult = El('float-result');
        this.BitGrid = El('bit-grid');
        this.BitsWrap = El('bits-wrap');
        this.ModeButtons = Array.from(document.querySelectorAll('[data-calcmode]'));
        this.Mode = Store.Get('calc.mode', 'int') === 'float' ? 'float' : 'int';
        this.WordSize = Number(Store.Get('calc.wordSize', 64));
        if ([8, 16, 32, 64].indexOf(this.WordSize) === -1) this.WordSize = 64;
        this.Angle = Store.Get('calc.angle', 'deg') === 'rad' ? 'rad' : 'deg';
        this.Expressions = {
            int: String(Store.Get('calc.expr.int', '') || ''),
            float: String(Store.Get('calc.expr.float', '') || '')
        };
        this.LastInt = 0n;
        this.LastFloat = 0;
        this.LastIntUnsigned = 0n;
        this.LastFloatValue = 0;
        this.Bind();
        this.SyncControls();
        this.ApplyMode();
        this.Evaluate(false);
    }

    Bind() {
        this.ExprInput.addEventListener('input', () => this.Evaluate(false));
        this.ExprInput.addEventListener('keydown', (Event) => {
            if (Event.key === 'Enter') {
                Event.preventDefault();
                this.Evaluate(true);
            } else if (Event.key === 'Escape') {
                Event.preventDefault();
                this.SetExpression('');
            }
        });
        this.ModeButtons.forEach((Button) => {
            Button.addEventListener('click', () => this.SetMode(Button.dataset.calcmode));
        });
        this.WordSizeSelect.addEventListener('change', () => {
            this.WordSize = Number(this.WordSizeSelect.value);
            Store.Set('calc.wordSize', this.WordSize);
            this.Evaluate(false);
        });
        this.AngleButton.addEventListener('click', () => {
            this.Angle = this.Angle === 'deg' ? 'rad' : 'deg';
            Store.Set('calc.angle', this.Angle);
            this.SyncControls();
            this.Evaluate(false);
        });
        [this.IntPad, this.FloatPad].forEach((Pad) => {
            Pad.addEventListener('click', (Event) => {
                const Button = Event.target.closest('button');
                if (!Button) return;
                if (Button.dataset.action) this.RunAction(Button.dataset.action);
                else if (Button.dataset.insert !== undefined) this.Insert(Button.dataset.insert);
            });
        });
        this.BitGrid.addEventListener('click', (Event) => {
            const Button = Event.target.closest('[data-bit]');
            if (!Button) return;
            const Index = BigInt(Number(Button.dataset.bit));
            const Next = this.LastIntUnsigned ^ (1n << Index);
            this.SetExpression('0x' + Next.toString(16).toUpperCase());
        });
        El('save-result').addEventListener('click', () => this.SaveResult());
        document.addEventListener('keydown', (Event) => {
            if (Event.ctrlKey || Event.altKey || Event.metaKey) return;
            const Target = Event.target;
            const Tag = Target && Target.tagName ? Target.tagName.toUpperCase() : '';
            if (Tag === 'INPUT' || Tag === 'TEXTAREA' || Tag === 'SELECT') return;
            if (Event.key.length === 1) {
                this.ExprInput.focus();
                this.Insert(Event.key);
                Event.preventDefault();
            }
        });
    }

    SyncControls() {
        this.WordSizeSelect.value = String(this.WordSize);
        this.AngleButton.textContent = this.Angle.toUpperCase();
        this.ModeButtons.forEach((Button) => {
            Button.classList.toggle('active', Button.dataset.calcmode === this.Mode);
        });
    }

    ApplyMode() {
        this.SyncControls();
        this.ExprInput.value = this.Expressions[this.Mode] || '';
        this.IntPad.classList.toggle('hidden', this.Mode !== 'int');
        this.FloatPad.classList.toggle('hidden', this.Mode !== 'float');
        this.IntResult.classList.toggle('hidden', this.Mode !== 'int');
        this.FloatResult.classList.toggle('hidden', this.Mode !== 'float');
        this.BitsWrap.classList.toggle('hidden', this.Mode !== 'int');
        this.ExprInput.placeholder = this.Mode === 'int'
            ? '0x90 ^ 0x2A | 1 << 31 | popcnt(0xFF) | bswap(0x41424344)'
            : 'sqrt(2) * pi | sin(30) | log(1000) | 1.5e3 / 4';
    }

    SetMode(Next) {
        if (Next === this.Mode) return;
        this.Expressions[this.Mode] = this.ExprInput.value;
        Store.Set('calc.expr.' + this.Mode, this.ExprInput.value);
        this.Mode = Next;
        Store.Set('calc.mode', Next);
        this.ApplyMode();
        this.Evaluate(false);
        this.ExprInput.focus();
    }

    SetExpression(Text) {
        this.ExprInput.value = Text;
        this.Evaluate(false);
        this.ExprInput.focus();
    }

    Insert(Text) {
        const Start = this.ExprInput.selectionStart === null ? this.ExprInput.value.length : this.ExprInput.selectionStart;
        const End = this.ExprInput.selectionEnd === null ? this.ExprInput.value.length : this.ExprInput.selectionEnd;
        this.ExprInput.value = this.ExprInput.value.slice(0, Start) + Text + this.ExprInput.value.slice(End);
        const Caret = Start + Text.length;
        this.ExprInput.setSelectionRange(Caret, Caret);
        this.ExprInput.focus();
        this.Evaluate(false);
    }

    RunAction(Action) {
        if (Action === 'clear') {
            this.SetExpression('');
            return;
        }
        if (Action === 'del') {
            const Start = this.ExprInput.selectionStart;
            const End = this.ExprInput.selectionEnd;
            if (Start === null || End === null) return;
            if (Start === End) {
                if (Start === 0) return;
                this.SetExpression(this.ExprInput.value.slice(0, Start - 1) + this.ExprInput.value.slice(End));
                this.ExprInput.setSelectionRange(Start - 1, Start - 1);
                return;
            }
            this.SetExpression(this.ExprInput.value.slice(0, Start) + this.ExprInput.value.slice(End));
            this.ExprInput.setSelectionRange(Start, Start);
            return;
        }
        if (Action === 'equals') {
            this.Evaluate(true);
        }
    }

    Evaluate(Commit) {
        const Source = this.ExprInput.value;
        this.Expressions[this.Mode] = Source;
        Store.Set('calc.expr.' + this.Mode, Source);
        this.ResultStatus.classList.remove('error');
        if (!Source.trim()) {
            this.ResultBig.textContent = '0';
            this.ResultStatus.textContent = '';
            this.ResetResults();
            return;
        }
        let Value = null;
        try {
            const Parser = new ExpressionParser(Source, {
                Mode: this.Mode,
                Size: this.WordSize,
                Angle: this.Angle,
                Ans: this.Mode === 'int' ? this.LastInt : this.LastFloat
            });
            Value = Parser.Parse();
        } catch (Error) {
            this.ResultStatus.textContent = Error.message;
            this.ResultStatus.classList.add('error');
            this.ResultBig.textContent = '—';
            return;
        }
        this.ResultStatus.textContent = '';
        if (this.Mode === 'int') {
            this.RenderInt(Value);
            if (Commit) {
                this.LastInt = Value;
                if (Value === 1909n) Confetti();
                if (Value === 67n) Shake();
            }
        } else {
            this.RenderFloat(Value);
            if (Commit) {
                if (!Number.isNaN(Value)) this.LastFloat = Value;
                if (Value === 1909) Confetti();
                if (Value === 67) Shake();
            }
        }
    }

    ResetResults() {
        El('res-signed').textContent = '0';
        El('res-unsigned').textContent = '0';
        El('res-hex').textContent = '0x0';
        El('res-bin').textContent = '0';
        El('res-oct').textContent = '0o0';
        El('res-ascii-be').textContent = '';
        El('res-ascii-le').textContent = '';
        El('res-flags').textContent = '';
        El('fres-value').textContent = '0';
        El('fres-expo').textContent = '';
        El('fres-bits64').textContent = '';
        El('fres-bits32').textContent = '';
        El('fres-bytes').textContent = '';
        El('fres-class').textContent = '';
        this.BitGrid.innerHTML = '';
        this.LastIntUnsigned = 0n;
        this.LastFloatValue = 0;
    }

    RenderInt(Value) {
        const Info = FormatInt(Value, this.WordSize);
        this.LastIntUnsigned = Info.Unsigned;
        this.ResultBig.textContent = Info.HexText;
        El('res-signed').textContent = Info.SignedText;
        El('res-unsigned').textContent = Info.UnsignedText;
        El('res-hex').textContent = Info.HexText;
        El('res-bin').textContent = Info.BinaryText;
        El('res-oct').textContent = Info.OctalText;
        El('res-ascii-be').textContent = Info.AsciiBe || '—';
        El('res-ascii-le').textContent = Info.AsciiLe || '—';
        El('res-flags').textContent = 'popcnt ' + Info.PopCount + ' · clz ' + Info.Clz + ' · ctz ' + Info.Ctz + ' · ' + (Info.Unsigned === 0n ? 'ZF' : 'NZ') + ' · ' + (Info.Signed < 0n ? 'SF' : 'PF');
        this.RenderBits(Info.Unsigned, this.WordSize);
    }

    RenderFloat(Value) {
        const Info = FormatFloat(Value);
        this.LastFloatValue = Value;
        this.ResultBig.textContent = String(Value);
        El('fres-value').textContent = String(Value);
        El('fres-expo').textContent = Info.ExponentText;
        El('fres-bits64').textContent = Info.Bits64Text;
        El('fres-bits32').textContent = Info.Bits32Text;
        El('fres-bytes').textContent = Info.BytesText || '—';
        El('fres-class').textContent = Info.ClassName + ' · ' + Info.SignText;
    }

    RenderBits(Value, Size) {
        this.BitGrid.innerHTML = '';
        for (let Index = Size - 1; Index >= 0; Index -= 1) {
            const Bit = Number((Value >> BigInt(Index)) & 1n);
            const Button = document.createElement('button');
            Button.type = 'button';
            Button.className = 'Bit' + (Bit ? ' On' : '');
            Button.dataset.bit = String(Index);
            Button.title = 'bit ' + Index;
            Button.textContent = String(Bit);
            this.BitGrid.appendChild(Button);
        }
    }

    SaveResult() {
        const Source = this.ExprInput.value.trim() || 'calc';
        if (this.Mode === 'int') {
            const Info = FormatInt(this.LastIntUnsigned, this.WordSize);
            Scratch.Add(Source, Info.HexText, 'signed ' + Info.SignedText + ' | popcnt ' + Info.PopCount);
            return;
        }
        const Info = FormatFloat(this.LastFloatValue);
        Scratch.Add(Source, String(this.LastFloatValue), 'f64 ' + Info.Bits64Text + ' | f32 ' + Info.Bits32Text);
    }
}

function HexToBytes(Text) {
    const Clean = String(Text).replace(/0x/gi, ' ').replace(/\\x/gi, ' ').replace(/[^0-9a-fA-F]/g, '');
    if (Clean.length % 2 !== 0) throw new Error('odd hex digit count');
    const Bytes = new Uint8Array(Clean.length / 2);
    for (let Index = 0; Index < Bytes.length; Index += 1) {
        Bytes[Index] = parseInt(Clean.slice(Index * 2, Index * 2 + 2), 16);
    }
    return Bytes;
}

function BytesToHex(Bytes, Separator) {
    return Array.from(Bytes, (Byte) => Byte.toString(16).toUpperCase().padStart(2, '0')).join(Separator === undefined ? '' : Separator);
}

function EscToBytes(Text) {
    const Bytes = [];
    let Index = 0;
    while (Index < Text.length) {
        const Char = Text[Index];
        if (Char === '\\') {
            const Next = Text[Index + 1];
            if (Next === 'x' || Next === 'X') {
                const Pair = Text.slice(Index + 2, Index + 4);
                if (!/^[0-9a-fA-F]{2}$/.test(Pair)) throw new Error('bad \\x escape');
                Bytes.push(parseInt(Pair, 16));
                Index += 4;
                continue;
            }
            if (Next === 'n') {
                Bytes.push(10);
                Index += 2;
                continue;
            }
            if (Next === 'r') {
                Bytes.push(13);
                Index += 2;
                continue;
            }
            if (Next === 't') {
                Bytes.push(9);
                Index += 2;
                continue;
            }
            if (Next === '0') {
                Bytes.push(0);
                Index += 2;
                continue;
            }
            if (Next === '\\') {
                Bytes.push(92);
                Index += 2;
                continue;
            }
            Bytes.push(92);
            Index += 1;
            continue;
        }
        const Code = Char.codePointAt(0);
        if (Code > 0xff) throw new Error('character above 0xFF');
        Bytes.push(Code);
        Index += 1;
    }
    return new Uint8Array(Bytes);
}

function BytesToEsc(Bytes) {
    return Array.from(Bytes, (Byte) => '\\x' + Byte.toString(16).toUpperCase().padStart(2, '0')).join('');
}

function DecToBytes(Text) {
    const Parts = String(Text).split(/[^0-9]+/).filter((Part) => Part.length > 0);
    const Bytes = new Uint8Array(Parts.length);
    Parts.forEach((Part, Index) => {
        const Value = Number(Part);
        if (Value < 0 || Value > 255) throw new Error('byte out of range 0-255');
        Bytes[Index] = Value;
    });
    return Bytes;
}

function BytesToDec(Bytes) {
    return Array.from(Bytes).join(' ');
}

function BinToBytes(Text) {
    const Clean = String(Text).replace(/[^01]/g, '');
    if (Clean.length === 0) return new Uint8Array(0);
    if (Clean.length % 8 !== 0) throw new Error('bit count must be a multiple of 8');
    const Bytes = new Uint8Array(Clean.length / 8);
    for (let Index = 0; Index < Bytes.length; Index += 1) {
        Bytes[Index] = parseInt(Clean.slice(Index * 8, Index * 8 + 8), 2);
    }
    return Bytes;
}

function BytesToBin(Bytes) {
    return Array.from(Bytes, (Byte) => Byte.toString(2).padStart(8, '0')).join(' ');
}

function BytesToBase64(Bytes) {
    let Binary = '';
    const ChunkSize = 0x8000;
    for (let Index = 0; Index < Bytes.length; Index += ChunkSize) {
        Binary += String.fromCharCode.apply(null, Bytes.subarray(Index, Index + ChunkSize));
    }
    return btoa(Binary);
}

function Base64ToBytes(Text) {
    const Clean = String(Text).replace(/\s+/g, '');
    if (!Clean) return new Uint8Array(0);
    const Binary = atob(Clean);
    const Bytes = new Uint8Array(Binary.length);
    for (let Index = 0; Index < Binary.length; Index += 1) {
        Bytes[Index] = Binary.charCodeAt(Index);
    }
    return Bytes;
}

const CrcTable = (() => {
    const Table = new Uint32Array(256);
    for (let Index = 0; Index < 256; Index += 1) {
        let Current = Index;
        for (let Bit = 0; Bit < 8; Bit += 1) {
            Current = Current & 1 ? 0xedb88320 ^ (Current >>> 1) : Current >>> 1;
        }
        Table[Index] = Current >>> 0;
    }
    return Table;
})();

function Crc32(Bytes) {
    let Crc = 0xffffffff;
    for (const Byte of Bytes) {
        Crc = CrcTable[(Crc ^ Byte) & 0xff] ^ (Crc >>> 8);
    }
    return ((Crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function ParseRadix(Text, Radix) {
    if (Radix < 2 || Radix > 36) throw new Error('base out of range');
    const Big = BigInt(Radix);
    let Value = 0n;
    for (const Char of Text.toLowerCase()) {
        const Digit = parseInt(Char, 36);
        if (!Number.isFinite(Digit) || Digit >= Radix) throw new Error('bad digit');
        Value = Value * Big + BigInt(Digit);
    }
    return Value;
}

function ParseIntegerInput(Text, Base) {
    let Body = String(Text);
    let Negative = false;
    if (Body.startsWith('-')) {
        Negative = true;
        Body = Body.slice(1);
    } else if (Body.startsWith('+')) {
        Body = Body.slice(1);
    }
    if (!Body) return null;
    let Value = null;
    try {
        if (Base === 'auto') {
            if (/^0[xX][0-9a-fA-F]+$/.test(Body)) Value = BigInt(Body);
            else if (/^0[bB][01]+$/.test(Body)) Value = BigInt(Body);
            else if (/^0[oO][0-7]+$/.test(Body)) Value = BigInt(Body);
            else if (/^[0-9a-fA-F]+[hH]$/.test(Body)) Value = BigInt('0x' + Body.slice(0, -1));
            else if (/^[0-9]+$/.test(Body)) Value = BigInt(Body);
            else if (/^[0-9a-fA-F]+$/.test(Body)) Value = BigInt('0x' + Body);
            else return null;
        } else {
            if (!/^[0-9a-zA-Z]+$/.test(Body)) return null;
            Value = ParseRadix(Body, Number(Base));
        }
    } catch (Error) {
        return null;
    }
    return Negative ? -Value : Value;
}

const PaneCodecs = [
    {
        Id: 'pane-text',
        ToBytes: (Text) => new TextEncoder().encode(Text),
        FromBytes: (Bytes) => new TextDecoder('utf-8').decode(Bytes)
    },
    {
        Id: 'pane-hex',
        ToBytes: (Text) => HexToBytes(Text),
        FromBytes: (Bytes) => BytesToHex(Bytes, ' ')
    },
    {
        Id: 'pane-esc',
        ToBytes: (Text) => EscToBytes(Text),
        FromBytes: (Bytes) => BytesToEsc(Bytes)
    },
    {
        Id: 'pane-dec',
        ToBytes: (Text) => DecToBytes(Text),
        FromBytes: (Bytes) => BytesToDec(Bytes)
    },
    {
        Id: 'pane-bin',
        ToBytes: (Text) => BinToBytes(Text),
        FromBytes: (Bytes) => BytesToBin(Bytes)
    },
    {
        Id: 'pane-b64',
        ToBytes: (Text) => Base64ToBytes(Text),
        FromBytes: (Bytes) => BytesToBase64(Bytes)
    },
    {
        Id: 'pane-url',
        ToBytes: (Text) => new TextEncoder().encode(decodeURIComponent(Text)),
        FromBytes: (Bytes) => encodeURIComponent(new TextDecoder('utf-8').decode(Bytes))
    }
];

class ConverterPanel {
    constructor() {
        this.NumberInput = El('num-input');
        this.BaseSelect = El('num-base');
        this.NumberOutput = El('num-out');
        this.Panes = PaneCodecs.map((Codec) => ({
            Id: Codec.Id,
            ToBytes: Codec.ToBytes,
            FromBytes: Codec.FromBytes,
            Element: El(Codec.Id)
        }));
        this.LastSave = null;
        this.HashToken = 0;
        this.Restore();
        this.Bind();
        this.ConvertNumber();
    }

    Restore() {
        this.NumberInput.value = String(Store.Get('conv.number', '') || '');
        const Base = String(Store.Get('conv.base', 'auto'));
        this.BaseSelect.value = Base;
        const StoredHex = String(Store.Get('conv.hex', '') || '');
        let Bytes = new Uint8Array(0);
        if (StoredHex) {
            try {
                Bytes = HexToBytes(StoredHex);
            } catch (Error) {
                Bytes = new Uint8Array(0);
            }
        }
        this.FillFromBytes(Bytes, null);
        this.RefreshHashes(Bytes);
    }

    Bind() {
        this.NumberInput.addEventListener('input', () => this.ConvertNumber());
        this.BaseSelect.addEventListener('change', () => {
            Store.Set('conv.base', this.BaseSelect.value);
            this.ConvertNumber();
        });
        this.Panes.forEach((Pane) => {
            Pane.Element.addEventListener('input', () => this.HandlePaneInput(Pane));
        });
        El('num-save').addEventListener('click', () => this.SaveNumber());
        El('num-clear').addEventListener('click', () => {
            this.NumberInput.value = '';
            Store.Set('conv.number', '');
            this.NumberOutput.innerHTML = '';
            this.LastSave = null;
        });
        El('conv-save-bytes').addEventListener('click', () => this.SaveBytes());
        El('conv-clear').addEventListener('click', () => this.ClearAll());
    }

    CurrentBytes() {
        try {
            return HexToBytes(El('pane-hex').value);
        } catch (Error) {
        }
        try {
            return new TextEncoder().encode(El('pane-text').value);
        } catch (Error) {
            return new Uint8Array(0);
        }
    }

    ConvertNumber() {
        const Raw = this.NumberInput.value;
        Store.Set('conv.number', Raw);
        this.NumberOutput.innerHTML = '';
        this.LastSave = null;
        const Trimmed = Raw.trim().replace(/_/g, '');
        if (!Trimmed) return;
        const Base = this.BaseSelect.value;
        const FloatLike = /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(Trimmed);
        if (Base === 'auto' && /[.eE]/.test(Trimmed) && FloatLike) {
            this.RenderFloatValue(Raw.trim());
            return;
        }
        const Parsed = ParseIntegerInput(Trimmed, Base);
        if (Parsed === null) {
            this.AddRow('ERROR', 'unrecognized number');
            return;
        }
        this.RenderInteger(Raw.trim(), Parsed);
    }

    AddRow(Key, Value) {
        const Row = document.createElement('div');
        Row.className = 'KV';
        const KeyNode = document.createElement('span');
        KeyNode.className = 'K';
        KeyNode.textContent = Key;
        const ValueNode = document.createElement('span');
        ValueNode.className = 'V Val Wrap';
        const Text = Value === undefined || Value === null ? '' : String(Value);
        ValueNode.textContent = Text === '' ? '—' : Text;
        Row.appendChild(KeyNode);
        Row.appendChild(ValueNode);
        this.NumberOutput.appendChild(Row);
    }

    RenderInteger(Raw, Value) {
        const Unsigned = BigInt.asUintN(64, Value);
        const Info = FormatInt(Unsigned, 64);
        this.AddRow('DEC U', Info.UnsignedText);
        this.AddRow('DEC S', BigInt.asIntN(64, Value).toString());
        this.AddRow('HEX', Info.HexText);
        this.AddRow('BIN', Info.BinaryText);
        this.AddRow('OCT', Info.OctalText);
        this.AddRow('ASCII BE', Info.AsciiBe);
        this.AddRow('ASCII LE', Info.AsciiLe);
        this.AddRow('i8', BigInt.asIntN(8, Value).toString());
        this.AddRow('i16', BigInt.asIntN(16, Value).toString());
        this.AddRow('i32', BigInt.asIntN(32, Value).toString());
        this.AddRow('u8', BigInt.asUintN(8, Value).toString());
        this.AddRow('u16', BigInt.asUintN(16, Value).toString());
        this.AddRow('u32', BigInt.asUintN(32, Value).toString());
        this.AddRow('F64', FormatFloatReadable(Float64FromBits(Unsigned)));
        this.AddRow('F32', FormatFloatReadable(Float32FromBits(Unsigned)));
        if (Value > 0xffffffffffffffffn || Value < -0x8000000000000000n) {
            this.AddRow('NOTE', 'showing low 64 bits');
        }
        this.LastSave = {
            Label: Raw,
            Value: Info.HexText,
            Note: 'u ' + Info.UnsignedText + ' | s ' + BigInt.asIntN(64, Value).toString()
        };
    }

    RenderFloatValue(Raw) {
        const Value = Number(Raw);
        const Info = FormatFloat(Value);
        this.AddRow('VALUE', String(Value));
        this.AddRow('EXPO', Info.ExponentText);
        this.AddRow('F64 BITS', Info.Bits64Text);
        this.AddRow('F32 BITS', Info.Bits32Text);
        this.AddRow('F64 BYTES', Info.BytesText);
        this.AddRow('CLASS', Info.ClassName + ' · ' + Info.SignText);
        this.LastSave = {
            Label: Raw,
            Value: Info.Bits64Text,
            Note: 'f64 bits | f32 ' + Info.Bits32Text
        };
    }

    SaveNumber() {
        if (!this.LastSave) {
            Toast('nothing to save');
            return;
        }
        Scratch.Add(this.LastSave.Label, this.LastSave.Value, this.LastSave.Note);
    }

    HandlePaneInput(Pane) {
        let Bytes = null;
        try {
            Bytes = Pane.ToBytes(Pane.Element.value);
            Pane.Element.classList.remove('invalid');
        } catch (Error) {
            Pane.Element.classList.add('invalid');
            return;
        }
        this.FillFromBytes(Bytes, Pane.Element);
        Store.Set('conv.hex', BytesToHex(Bytes, ''));
        this.RefreshHashes(Bytes);
    }

    FillFromBytes(Bytes, SkipElement) {
        this.Panes.forEach((Pane) => {
            if (Pane.Element === SkipElement) return;
            try {
                Pane.Element.value = Pane.FromBytes(Bytes);
                Pane.Element.classList.remove('invalid');
            } catch (Error) {
                Pane.Element.classList.add('invalid');
            }
        });
    }

    RefreshHashes(Bytes) {
        const Source = Bytes || this.CurrentBytes();
        El('hash-crc32').textContent = '0x' + Crc32(Source);
        const Jobs = [['SHA-1', 'hash-sha1'], ['SHA-256', 'hash-sha256'], ['SHA-512', 'hash-sha512']];
        if (!window.crypto || !window.crypto.subtle) {
            Jobs.forEach((Job) => {
                El(Job[1]).textContent = 'unavailable (crypto.subtle missing)';
            });
            return;
        }
        const Token = ++this.HashToken;
        Jobs.forEach((Job) => {
            window.crypto.subtle.digest(Job[0], Source).then((Digest) => {
                if (Token !== this.HashToken) return;
                El(Job[1]).textContent = BytesToHex(new Uint8Array(Digest), '');
            }).catch(() => {
                if (Token !== this.HashToken) return;
                El(Job[1]).textContent = 'unavailable';
            });
        });
    }

    SaveBytes() {
        const Bytes = this.CurrentBytes();
        const Hex = BytesToHex(Bytes, ' ');
        if (!Hex) {
            Toast('nothing to save');
            return;
        }
        const Text = new TextDecoder('utf-8').decode(Bytes);
        Scratch.Add(Text.slice(0, 40) || 'bytes', Hex, 'len ' + Bytes.length);
    }

    ClearAll() {
        this.Panes.forEach((Pane) => {
            Pane.Element.value = '';
            Pane.Element.classList.remove('invalid');
        });
        Store.Set('conv.hex', '');
        this.RefreshHashes(new Uint8Array(0));
    }
}

class ScratchPanel {
    constructor() {
        this.Entries = Store.Get('scratch', []);
        if (!Array.isArray(this.Entries)) this.Entries = [];
        this.Form = El('scratch-form');
        this.LabelInput = El('scratch-label');
        this.ValueInput = El('scratch-value');
        this.NoteInput = El('scratch-note');
        this.Body = El('scratch-tbody');
        this.Count = El('scratch-count');
        this.Empty = El('scratch-empty');
        this.Bind();
        this.Render();
    }

    Bind() {
        this.Form.addEventListener('submit', (Event) => {
            Event.preventDefault();
            const Label = this.LabelInput.value.trim();
            const Value = this.ValueInput.value.trim();
            const Note = this.NoteInput.value.trim();
            if (!Label && !Value) {
                Toast('label or value required');
                return;
            }
            this.Add(Label, Value, Note);
            this.Form.reset();
            this.LabelInput.focus();
        });
        this.Body.addEventListener('click', (Event) => {
            const CopyButton = Event.target.closest('[data-copy]');
            if (CopyButton) {
                const Entry = this.Find(CopyButton.dataset.copy);
                if (Entry) CopyText(Entry.Value);
                return;
            }
            const PairButton = Event.target.closest('[data-copy-pair]');
            if (PairButton) {
                const Entry = this.Find(PairButton.dataset.copyPair);
                if (Entry) CopyText(Entry.Label + ' = ' + Entry.Value);
                return;
            }
            const DeleteButton = Event.target.closest('[data-delete]');
            if (DeleteButton) {
                this.Entries = this.Entries.filter((Entry) => Entry.Id !== DeleteButton.dataset.delete);
                this.Save();
                this.Render();
            }
        });
        El('scratch-copy-all').addEventListener('click', () => {
            if (!this.Entries.length) {
                Toast('scratch is empty');
                return;
            }
            const Text = this.Entries.map((Entry) => {
                return [Entry.Label, Entry.Value, Entry.Note].filter((Part) => Part).join('\t');
            }).join('\n');
            CopyText(Text);
        });
        El('scratch-export').addEventListener('click', () => this.Export());
        El('scratch-import').addEventListener('click', () => El('scratch-file').click());
        El('scratch-file').addEventListener('change', (Event) => this.Import(Event));
        El('scratch-clear').addEventListener('click', () => {
            if (!this.Entries.length) return;
            if (!window.confirm('Clear all scratch entries?')) return;
            this.Entries = [];
            this.Save();
            this.Render();
            Toast('scratch cleared');
        });
    }

    Find(Id) {
        return this.Entries.find((Entry) => Entry.Id === Id) || null;
    }

    Add(Label, Value, Note) {
        this.Entries.unshift({
            Id: MakeId(),
            Label: String(Label || '').slice(0, 160),
            Value: String(Value || '').slice(0, 400),
            Note: String(Note || '').slice(0, 400),
            Time: Date.now()
        });
        if (this.Entries.length > 500) this.Entries = this.Entries.slice(0, 500);
        this.Save();
        this.Render();
        Toast('saved to scratch');
    }

    Save() {
        Store.Set('scratch', this.Entries);
    }

    Render() {
        this.Body.innerHTML = '';
        this.Count.textContent = String(this.Entries.length);
        this.Empty.classList.toggle('hidden', this.Entries.length > 0);
        this.Entries.forEach((Entry) => {
            const Row = document.createElement('tr');
            const LabelCell = document.createElement('td');
            LabelCell.textContent = Entry.Label || '—';
            LabelCell.title = Entry.Label;
            const ValueCell = document.createElement('td');
            ValueCell.className = 'CellValue';
            ValueCell.dataset.copy = Entry.Id;
            ValueCell.textContent = Entry.Value || '—';
            ValueCell.title = 'click to copy';
            const NoteCell = document.createElement('td');
            NoteCell.className = 'CellNote';
            NoteCell.textContent = Entry.Note || '';
            NoteCell.title = Entry.Note;
            const ActionCell = document.createElement('td');
            const ActionWrap = document.createElement('div');
            ActionWrap.className = 'CellActions';
            const PairButton = document.createElement('button');
            PairButton.type = 'button';
            PairButton.className = 'Mini';
            PairButton.dataset.copyPair = Entry.Id;
            PairButton.textContent = 'L=V';
            PairButton.title = 'copy label = value';
            const DeleteButton = document.createElement('button');
            DeleteButton.type = 'button';
            DeleteButton.className = 'Mini Danger';
            DeleteButton.dataset.delete = Entry.Id;
            DeleteButton.textContent = '✕';
            DeleteButton.title = 'delete entry';
            ActionWrap.appendChild(PairButton);
            ActionWrap.appendChild(DeleteButton);
            ActionCell.appendChild(ActionWrap);
            Row.appendChild(LabelCell);
            Row.appendChild(ValueCell);
            Row.appendChild(NoteCell);
            Row.appendChild(ActionCell);
            this.Body.appendChild(Row);
        });
    }

    Export() {
        const Payload = {
            exported: new Date().toISOString(),
            entries: this.Entries
        };
        const Blob = new Blob([JSON.stringify(Payload, null, 2)], { type: 'application/json' });
        const Link = document.createElement('a');
        Link.href = URL.createObjectURL(Blob);
        Link.download = 'revcalc-scratch.json';
        document.body.appendChild(Link);
        Link.click();
        setTimeout(() => {
            URL.revokeObjectURL(Link.href);
            Link.remove();
        }, 500);
    }

    Import(Event) {
        const File = Event.target.files && Event.target.files[0];
        if (!File) return;
        const Reader = new FileReader();
        Reader.onload = () => {
            let Parsed = null;
            try {
                Parsed = JSON.parse(String(Reader.result));
            } catch (Error) {
                Toast('invalid JSON');
                return;
            }
            const RawEntries = Array.isArray(Parsed) ? Parsed : (Parsed && Array.isArray(Parsed.entries) ? Parsed.entries : null);
            if (!RawEntries) {
                Toast('no entries found');
                return;
            }
            RawEntries.forEach((Entry) => {
                if (!Entry || typeof Entry !== 'object') return;
                this.Entries.unshift({
                    Id: MakeId(),
                    Label: String(Entry.Label || ''),
                    Value: String(Entry.Value || ''),
                    Note: String(Entry.Note || ''),
                    Time: Number(Entry.Time) || Date.now()
                });
            });
            this.Save();
            this.Render();
            Toast('imported ' + RawEntries.length + ' entries');
        };
        Reader.readAsText(File);
        Event.target.value = '';
    }
}

class NotepadPanel {
    constructor() {
        this.Area = El('notepad');
        this.Count = El('notepad-count');
        this.Area.value = String(Store.Get('notepad', '') || '');
        this.Persist = Debounce(() => Store.Set('notepad', this.Area.value), 250);
        this.Area.addEventListener('input', () => {
            this.Persist();
            this.UpdateCount();
        });
        this.UpdateCount();
        El('notepad-copy').addEventListener('click', () => CopyText(this.Area.value));
        El('notepad-clear').addEventListener('click', () => {
            if (!this.Area.value) return;
            if (!window.confirm('Clear the notepad?')) return;
            this.Area.value = '';
            Store.Set('notepad', '');
            this.UpdateCount();
        });
        window.addEventListener('beforeunload', () => Store.Set('notepad', this.Area.value));
    }

    UpdateCount() {
        const Text = this.Area.value;
        const Lines = Text ? Text.split('\n').length : 0;
        this.Count.textContent = Text.length + 'c / ' + Lines + 'l';
    }
}

class App {
    constructor() {
        this.ActiveTab = Store.Get('tab', 'calc') === 'convert' ? 'convert' : 'calc';
        this.ToolsButton = El('tools-toggle');
        this.ToolsMenu = El('tools-menu');
        this.BindTabs();
        this.BindTools();
        this.BindCopy();
        this.ApplyTab(this.ActiveTab);
    }

    BindTabs() {
        document.querySelectorAll('.TabBtn').forEach((Button) => {
            Button.addEventListener('click', () => this.ApplyTab(Button.dataset.tab));
        });
    }

    ApplyTab(Name) {
        this.ActiveTab = Name === 'convert' ? 'convert' : 'calc';
        Store.Set('tab', this.ActiveTab);
        document.querySelectorAll('.TabBtn').forEach((Button) => {
            Button.classList.toggle('active', Button.dataset.tab === this.ActiveTab);
        });
        El('calc-panel').classList.toggle('hidden', this.ActiveTab !== 'calc');
        El('convert-panel').classList.toggle('hidden', this.ActiveTab !== 'convert');
        if (this.ActiveTab === 'calc' && window.Calc) window.Calc.ExprInput.focus();
    }

    BindTools() {
        this.ToolsButton.addEventListener('click', (Event) => {
            Event.stopPropagation();
            const Open = this.ToolsMenu.classList.toggle('hidden');
            this.ToolsButton.setAttribute('aria-expanded', String(!Open));
        });
        document.addEventListener('click', (Event) => {
            if (this.ToolsMenu.classList.contains('hidden')) return;
            if (this.ToolsMenu.contains(Event.target) || Event.target === this.ToolsButton) return;
            this.ToolsMenu.classList.add('hidden');
            this.ToolsButton.setAttribute('aria-expanded', 'false');
        });
        document.addEventListener('keydown', (Event) => {
            if (Event.key !== 'Escape') return;
            this.ToolsMenu.classList.add('hidden');
            this.ToolsButton.setAttribute('aria-expanded', 'false');
        });
    }

    BindCopy() {
        document.addEventListener('click', (Event) => {
            const Target = Event.target.closest('.Val');
            if (!Target) return;
            CopyText(Target.textContent);
        });
    }
}

class MusicPlayer {
    constructor() {
        this.Audio = El('background-music');
        this.Button = El('music-toggle');
        this.Audio.addEventListener('play', () => this.Button.classList.add('playing'));
        this.Audio.addEventListener('pause', () => this.Button.classList.remove('playing'));
        this.Audio.addEventListener('error', () => {
            this.Button.disabled = true;
            this.Button.title = 'Music/track.mp3 not found';
            this.Button.classList.remove('playing');
        });
        this.Button.addEventListener('click', () => this.Toggle());
        if (Store.Get('music', false)) this.TryAutoplay();
    }

    Toggle() {
        if (!this.Audio.paused) {
            this.Audio.pause();
            Store.Set('music', false);
            return;
        }
        this.Play();
    }

    Play() {
        this.Audio.play().then(() => Store.Set('music', true)).catch(() => Toast('audio blocked — click again'));
    }

    TryAutoplay() {
        this.Audio.play().catch(() => {
            const Once = () => {
                this.Audio.play().catch(() => {});
                document.removeEventListener('click', Once);
            };
            document.addEventListener('click', Once);
        });
    }
}

function Confetti() {
    const Colors = ['#ff6b6b', '#00d4ff', '#51cf66', '#ffd43b', '#ff922b'];
    for (let Index = 0; Index < 140; Index += 1) {
        const Node = document.createElement('div');
        Node.className = 'confetti';
        const StartX = Math.random() * window.innerWidth;
        const Delay = Math.random() * 0.5;
        const Duration = 2.5 + Math.random() * 1.5;
        const Rotation = Math.random() * 720;
        const Drift = -50 + Math.random() * 100;
        Node.style.left = StartX + 'px';
        Node.style.top = '-20px';
        Node.style.setProperty('--random-drift', Drift + 'px');
        Node.style.setProperty('--random-rotation', Rotation + 'deg');
        Node.style.animation = 'confettiFallRandom ' + Duration + 's ease-in forwards';
        Node.style.animationDelay = Delay + 's';
        Node.style.background = Colors[Math.floor(Math.random() * Colors.length)];
        document.body.appendChild(Node);
        setTimeout(() => Node.remove(), (Duration + Delay) * 1000 + 150);
    }
}

function Shake() {
    const Panel = El('calc-panel');
    if (!Panel) return;
    Panel.classList.remove('split-shake');
    void Panel.offsetWidth;
    Panel.classList.add('split-shake');
    setTimeout(() => Panel.classList.remove('split-shake'), 1300);
}

document.addEventListener('DOMContentLoaded', () => {
    window.Scratch = new ScratchPanel();
    window.Notes = new NotepadPanel();
    window.Converter = new ConverterPanel();
    window.Calc = new CalculatorPanel();
    window.Shell = new App();
    window.Music = new MusicPlayer();
});




