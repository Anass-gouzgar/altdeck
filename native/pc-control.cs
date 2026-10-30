using System;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Windows.Forms;
using System.Text;

namespace AltDeckNative
{
    // COM interfaces for Windows CoreAudio Master Volume & Mute
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioEndpointVolume
    {
        int RegisterControlChangeNotify(IntPtr pNotify);
        int UnregisterControlChangeNotify(IntPtr pNotify);
        int GetChannelCount(out uint pnChannelCount);
        int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
        int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
        int GetMasterVolumeLevel(out float pfLevelDB);
        int GetMasterVolumeLevelScalar(out float pfLevel);
        int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
        int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
        int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
        int GetMute(out bool pbMute);
        int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
        int VolumeStepUp(ref Guid pguidEventContext);
        int VolumeStepDown(ref Guid pguidEventContext);
        int QueryHardwareSupport(out uint pdwHardwareSupportMask);
        int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDevice
    {
        int Activate(ref Guid id, int clsCtx, IntPtr activationParams, out IAudioEndpointVolume aev);
    }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDeviceEnumerator
    {
        int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr ppDevices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    public class MMDeviceEnumeratorComObject { }

    class Program
    {
        [DllImport("user32.dll")]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        static extern uint MapVirtualKey(uint uCode, uint uMapType);

        [DllImport("user32.dll")]
        static extern short VkKeyScan(char ch);

        [DllImport("user32.dll")]
        static extern short GetKeyState(int nVirtKey);

        [StructLayout(LayoutKind.Sequential)]
        struct INPUT
        {
            public uint type;
            public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [DllImport("user32.dll", SetLastError = true)]
        static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [DllImport("user32.dll")]
        static extern bool LockWorkStation();

        [DllImport("user32.dll")]
        static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll")]
        static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll")]
        static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

        [DllImport("user32.dll")]
        static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

        [DllImport("user32.dll")]
        static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        const uint WM_SYSCOMMAND = 0x0112;
        const int SC_MONITORPOWER = 0xF170;

        delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        const int SW_RESTORE = 9;
        const int SW_MAXIMIZE = 3;
        const int SW_MINIMIZE = 6;
        const uint SWP_NOZORDER = 0x0004;
        const uint SWP_SHOWWINDOW = 0x0040;
        const uint MONITOR_DEFAULTTONEAREST = 2;
        const uint WM_CLOSE = 0x0010;

        [StructLayout(LayoutKind.Sequential)]
        struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct MONITORINFO
        {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public uint dwFlags;
        }

        [DllImport("PowrProf.dll", CharSet = CharSet.Auto, ExactSpelling = true)]
        public static extern bool SetSuspendState(bool hiberate, bool forceCritical, bool disableWakeEvent);

        [DllImport("user32.dll")]
        static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        const uint INPUT_KEYBOARD = 1;
        const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
        const uint KEYEVENTF_KEYUP = 0x0002;
        const uint KEYEVENTF_UNICODE = 0x0004;

        // Virtual key codes
        const byte VK_BACK = 0x08;
        const byte VK_TAB = 0x09;
        const byte VK_RETURN = 0x0D;
        const byte VK_ESCAPE = 0x1B;
        const byte VK_SPACE = 0x20;
        const byte VK_DELETE = 0x2E;
        const byte VK_LEFT = 0x25;
        const byte VK_UP = 0x26;
        const byte VK_RIGHT = 0x27;
        const byte VK_DOWN = 0x28;

        const byte VK_VOLUME_MUTE = 0xAD;
        const byte VK_VOLUME_DOWN = 0xAE;
        const byte VK_VOLUME_UP = 0xAF;
        const byte VK_MEDIA_NEXT_TRACK = 0xB0;
        const byte VK_MEDIA_PREV_TRACK = 0xB1;
        const byte VK_MEDIA_STOP = 0xB2;
        const byte VK_MEDIA_PLAY_PAUSE = 0xB3;

        const byte VK_MENU = 0x12; // Alt
        const byte VK_LWIN = 0x5B;
        const byte VK_SHIFT = 0x10;
        const byte VK_CONTROL = 0x11;
        const byte VK_D = 0x44;
        const byte VK_S = 0x53;
        const byte VK_F4 = 0x73;
        const byte VK_F5 = 0x74; // Dell Latitude 7400 Backlight key
        const byte VK_F10 = 0x79; // Alternate Dell backlight key

        const uint MOUSEEVENTF_MOVE = 0x0001;
        const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        const uint MOUSEEVENTF_LEFTUP = 0x0004;
        const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        const uint MOUSEEVENTF_WHEEL = 0x0800;

        private static IAudioEndpointVolume GetAudioEndpointVolume()
        {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            IMMDevice dev = null;
            enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
            var iid = typeof(IAudioEndpointVolume).GUID;
            IAudioEndpointVolume epv = null;
            dev.Activate(ref iid, 23, IntPtr.Zero, out epv);
            return epv;
        }

        private static IAudioEndpointVolume GetMicEndpointVolume()
        {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            IMMDevice dev = null;
            // Try capture communications first (1, 2), then multimedia capture (1, 1)
            int hr = enumerator.GetDefaultAudioEndpoint(1, 2, out dev);
            if (hr != 0 || dev == null)
            {
                enumerator.GetDefaultAudioEndpoint(1, 1, out dev);
            }
            if (dev == null) return null;
            var iid = typeof(IAudioEndpointVolume).GUID;
            IAudioEndpointVolume epv = null;
            dev.Activate(ref iid, 23, IntPtr.Zero, out epv);
            return epv;
        }

        // Modern, rock-solid media key simulation with SendInput and hardware scan codes
        static void TriggerMediaKeyRobust(byte vk)
        {
            ushort scan = (ushort)MapVirtualKey(vk, 0);

            // 1. SendInput key down
            INPUT[] inputs = new INPUT[2];
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].ki.wVk = vk;
            inputs[0].ki.wScan = scan;
            inputs[0].ki.dwFlags = KEYEVENTF_EXTENDEDKEY;

            // SendInput key up
            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].ki.wVk = vk;
            inputs[1].ki.wScan = scan;
            inputs[1].ki.dwFlags = KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP;

            SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));

            // 2. Fallback keybd_event with scan code & dwell time
            keybd_event(vk, (byte)scan, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            System.Threading.Thread.Sleep(30);
            keybd_event(vk, (byte)scan, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
        }

        static bool IsExtendedKey(byte vk)
        {
            return vk == VK_LWIN || vk == 0x5C || // Win keys
                   vk == VK_LEFT || vk == VK_UP || vk == VK_RIGHT || vk == VK_DOWN || // Arrows
                   vk == 0x2D || vk == 0x2E || // Insert, Delete
                   vk == 0x24 || vk == 0x23 || // Home, End
                   vk == 0x21 || vk == 0x22 || // Page Up, Page Down
                   vk == 0x90; // NumLock
        }

        static void PressKey(byte vk, bool down)
        {
            uint flags = down ? 0 : KEYEVENTF_KEYUP;
            if (IsExtendedKey(vk)) flags |= KEYEVENTF_EXTENDEDKEY;
            byte scan = (byte)MapVirtualKey(vk, 0);
            keybd_event(vk, scan, flags, UIntPtr.Zero);
        }

        static void SendCombo(params byte[] keys)
        {
            for (int i = 0; i < keys.Length; i++)
            {
                PressKey(keys[i], true);
                System.Threading.Thread.Sleep(30);
            }
            System.Threading.Thread.Sleep(50);
            for (int i = keys.Length - 1; i >= 0; i--)
            {
                PressKey(keys[i], false);
                System.Threading.Thread.Sleep(20);
            }
        }

        static IntPtr GetTargetAppWindow()
        {
            IntPtr hwnd = GetForegroundWindow();
            if (hwnd != IntPtr.Zero && IsValidAppWindow(hwnd)) return hwnd;

            IntPtr found = IntPtr.Zero;
            EnumWindows((h, l) =>
            {
                if (IsValidAppWindow(h))
                {
                    found = h;
                    return false;
                }
                return true;
            }, IntPtr.Zero);

            return found != IntPtr.Zero ? found : hwnd;
        }

        static bool IsValidAppWindow(IntPtr hWnd)
        {
            if (!IsWindowVisible(hWnd)) return false;
            if (GetWindowTextLength(hWnd) == 0) return false;

            StringBuilder cls = new StringBuilder(64);
            GetClassName(hWnd, cls, 64);
            string c = cls.ToString();
            if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd" || c == "Windows.UI.Core.CoreWindow")
                return false;

            int style = GetWindowLong(hWnd, -16);
            int exStyle = GetWindowLong(hWnd, -20);
            if ((style & 0x40000000) != 0) return false; // WS_CHILD
            if ((exStyle & 0x00000080) != 0) return false; // WS_EX_TOOLWINDOW

            return true;
        }


        static void PressVk(byte vk, bool extended = false)
        {
            byte scan = (byte)MapVirtualKey(vk, 0);
            uint flags = extended ? KEYEVENTF_EXTENDEDKEY : 0;
            keybd_event(vk, scan, flags, UIntPtr.Zero);
            System.Threading.Thread.Sleep(15);
            keybd_event(vk, scan, flags | KEYEVENTF_KEYUP, UIntPtr.Zero);
        }

        static void SendChar(char c)
        {
            if (c == '\r') return;
            if (c == '\n')
            {
                PressVk(VK_RETURN);
                return;
            }
            if (c == '\t')
            {
                PressVk(VK_TAB);
                return;
            }

            short vkey = VkKeyScan(c);
            if (vkey == -1) return;

            byte vk = (byte)(vkey & 0xff);
            byte shiftState = (byte)((vkey >> 8) & 0xff);

            bool needShift = (shiftState & 1) != 0;
            bool needCtrl = (shiftState & 2) != 0;
            bool needAlt = (shiftState & 4) != 0;

            if (needShift) keybd_event(VK_SHIFT, 0, 0, UIntPtr.Zero);
            if (needCtrl) keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
            if (needAlt) keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);

            byte scan = (byte)MapVirtualKey(vk, 0);
            keybd_event(vk, scan, 0, UIntPtr.Zero);
            System.Threading.Thread.Sleep(10);
            keybd_event(vk, scan, KEYEVENTF_KEYUP, UIntPtr.Zero);

            if (needAlt) keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            if (needCtrl) keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            if (needShift) keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }

        static void SendText(string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            foreach (char c in text)
            {
                SendChar(c);
                System.Threading.Thread.Sleep(5);
            }
        }

        static void Main(string[] args)
        {
            if (args.Length == 0)
            {
                Console.WriteLine("{\"status\":\"error\",\"message\":\"No command provided\"}");
                return;
            }

            string category = args[0].ToLower();
            string action = args.Length > 1 ? args[1].ToLower() : "";
            string param = args.Length > 2 ? string.Join(" ", args, 2, args.Length - 2) : "";

            try
            {
                switch (category)
                {
                    case "volume":
                        HandleVolume(action, param);
                        break;

                    case "mic":
                        HandleMic(action, param);
                        break;

                    case "media":
                        HandleMedia(action);
                        break;

                    case "brightness":
                        HandleBrightness(action, param);
                        break;

                    case "window":
                        HandleWindow(action);
                        break;

                    case "keyboard":
                        HandleKeyboard(action, param);
                        break;

                    case "system":
                        HandleSystem(action, param);
                        break;

                    case "mouse":
                        HandleMouse(action, param, args.Length > 3 ? args[3] : "");
                        break;

                    case "battery":
                    case "power":
                        HandlePower();
                        break;

                    case "processes":
                    case "process":
                        HandleProcesses(action, param);
                        break;

                    default:
                        Console.WriteLine("{\"status\":\"error\",\"message\":\"Unknown category: " + category + "\"}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("{\"status\":\"error\",\"message\":" + JsonString(ex.Message) + "}");
            }
        }

        static void HandleVolume(string action, string param)
        {
            var epv = GetAudioEndpointVolume();
            Guid g = Guid.Empty;

            if (action == "get")
            {
                float level = 0;
                bool muted = false;
                epv.GetMasterVolumeLevelScalar(out level);
                epv.GetMute(out muted);
                int percent = (int)Math.Round(level * 100f);
                Console.WriteLine("{\"status\":\"ok\",\"volume\":" + percent + ",\"muted\":" + (muted ? "true" : "false") + "}");
            }
            else if (action == "set")
            {
                float target = float.Parse(param);
                if (target < 0) target = 0;
                if (target > 100) target = 100;
                epv.SetMasterVolumeLevelScalar(target / 100f, ref g);
                Console.WriteLine("{\"status\":\"ok\",\"volume\":" + (int)target + "}");
            }
            else if (action == "mute")
            {
                bool current = false;
                epv.GetMute(out current);
                bool target = !current;
                if (param == "true") target = true;
                else if (param == "false") target = false;
                epv.SetMute(target, ref g);
                Console.WriteLine("{\"status\":\"ok\",\"muted\":" + (target ? "true" : "false") + "}");
            }
            else if (action == "up")
            {
                float level = 0;
                epv.GetMasterVolumeLevelScalar(out level);
                float step = string.IsNullOrEmpty(param) ? 5f : float.Parse(param);
                float target = Math.Min(100f, (level * 100f) + step);
                epv.SetMasterVolumeLevelScalar(target / 100f, ref g);
                Console.WriteLine("{\"status\":\"ok\",\"volume\":" + (int)Math.Round(target) + "}");
            }
            else if (action == "down")
            {
                float level = 0;
                epv.GetMasterVolumeLevelScalar(out level);
                float step = string.IsNullOrEmpty(param) ? 5f : float.Parse(param);
                float target = Math.Max(0f, (level * 100f) - step);
                epv.SetMasterVolumeLevelScalar(target / 100f, ref g);
                Console.WriteLine("{\"status\":\"ok\",\"volume\":" + (int)Math.Round(target) + "}");
            }
        }

        static void HandleMic(string action, string param)
        {
            try
            {
                var epv = GetMicEndpointVolume();
                if (epv == null)
                {
                    Console.WriteLine("{\"status\":\"error\",\"message\":\"No microphone device found\"}");
                    return;
                }

                Guid g = Guid.Empty;
                if (action == "get")
                {
                    bool muted = false;
                    epv.GetMute(out muted);
                    float level = 0;
                    epv.GetMasterVolumeLevelScalar(out level);
                    int percent = (int)Math.Round(level * 100f);
                    Console.WriteLine("{\"status\":\"ok\",\"micMuted\":" + (muted ? "true" : "false") + ",\"micVolume\":" + percent + "}");
                }
                else if (action == "mute" || action == "toggle")
                {
                    bool current = false;
                    epv.GetMute(out current);
                    bool target = !current;
                    if (param == "true") target = true;
                    else if (param == "false") target = false;
                    epv.SetMute(target, ref g);
                    Console.WriteLine("{\"status\":\"ok\",\"micMuted\":" + (target ? "true" : "false") + "}");
                }
                else if (action == "set")
                {
                    float target = float.Parse(param);
                    if (target < 0) target = 0;
                    if (target > 100) target = 100;
                    epv.SetMasterVolumeLevelScalar(target / 100f, ref g);
                    Console.WriteLine("{\"status\":\"ok\",\"micVolume\":" + (int)target + "}");
                }
                else
                {
                    Console.WriteLine("{\"status\":\"error\",\"message\":\"Unknown mic action: " + action + "\"}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("{\"status\":\"error\",\"message\":" + JsonString(ex.Message) + "}");
            }
        }

        static void HandleMedia(string action)
        {
            switch (action)
            {
                case "playpause":
                    TriggerMediaKeyRobust(VK_MEDIA_PLAY_PAUSE);
                    break;
                case "next":
                    TriggerMediaKeyRobust(VK_MEDIA_NEXT_TRACK);
                    break;
                case "prev":
                    TriggerMediaKeyRobust(VK_MEDIA_PREV_TRACK);
                    break;
                case "stop":
                    TriggerMediaKeyRobust(VK_MEDIA_STOP);
                    break;
                default:
                    Console.WriteLine("{\"status\":\"error\",\"message\":\"Unknown media action\"}");
                    return;
            }
            Console.WriteLine("{\"status\":\"ok\",\"action\":\"" + action + "\"}");
        }

        static void HandleBrightness(string action, string param)
        {
            try
            {
                using (var searcher = new ManagementObjectSearcher("root\\wmi", "SELECT * FROM WmiMonitorBrightness"))
                {
                    if (action == "get")
                    {
                        foreach (ManagementObject obj in searcher.Get())
                        {
                            byte current = (byte)obj.GetPropertyValue("CurrentBrightness");
                            Console.WriteLine("{\"status\":\"ok\",\"brightness\":" + current + "}");
                            return;
                        }
                    }
                }

                if (action == "set")
                {
                    int val = int.Parse(param);
                    if (val < 0) val = 0;
                    if (val > 100) val = 100;

                    using (var searcherMethods = new ManagementObjectSearcher("root\\wmi", "SELECT * FROM WmiMonitorBrightnessMethods"))
                    {
                        foreach (ManagementObject obj in searcherMethods.Get())
                        {
                            ManagementBaseObject inParams = obj.GetMethodParameters("WmiSetBrightness");
                            inParams["Timeout"] = 1;
                            inParams["Brightness"] = (byte)val;
                            obj.InvokeMethod("WmiSetBrightness", inParams, null);
                            Console.WriteLine("{\"status\":\"ok\",\"brightness\":" + val + "}");
                            return;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("{\"status\":\"error\",\"message\":" + JsonString(ex.Message) + "}");
                return;
            }
            Console.WriteLine("{\"status\":\"error\",\"message\":\"Brightness not supported or monitor not detected\"}");
        }

        static void HandleWindow(string action)
        {
            IntPtr hwnd = GetTargetAppWindow();

            switch (action)
            {
                case "switch":
                    SendCombo(VK_MENU, VK_TAB);
                    break;
                case "taskview":
                    SendCombo(VK_LWIN, VK_TAB);
                    break;
                case "desktop":
                    SendCombo(VK_LWIN, VK_D);
                    break;
                case "screenshot":
                    SendCombo(VK_LWIN, VK_SHIFT, VK_S);
                    break;
                case "close":
                    if (hwnd != IntPtr.Zero)
                    {
                        PostMessage(hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                    }
                    SendCombo(VK_MENU, VK_F4);
                    break;

                // Feature #4: Window Snap Layouts (Direct Win32 + Hotkey Sync)
                case "snap-left":
                case "snapleft":
                    if (hwnd != IntPtr.Zero)
                    {
                        IntPtr hMon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                        MONITORINFO mi = new MONITORINFO();
                        mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
                        if (GetMonitorInfo(hMon, ref mi))
                        {
                            int workX = mi.rcWork.Left;
                            int workY = mi.rcWork.Top;
                            int workW = mi.rcWork.Right - mi.rcWork.Left;
                            int workH = mi.rcWork.Bottom - mi.rcWork.Top;
                            ShowWindow(hwnd, SW_RESTORE);
                            SetWindowPos(hwnd, IntPtr.Zero, workX, workY, workW / 2, workH, SWP_NOZORDER | SWP_SHOWWINDOW);
                        }
                    }
                    SendCombo(VK_LWIN, VK_LEFT);
                    break;

                case "snap-right":
                case "snapright":
                    if (hwnd != IntPtr.Zero)
                    {
                        IntPtr hMon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                        MONITORINFO mi = new MONITORINFO();
                        mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
                        if (GetMonitorInfo(hMon, ref mi))
                        {
                            int workX = mi.rcWork.Left;
                            int workY = mi.rcWork.Top;
                            int workW = mi.rcWork.Right - mi.rcWork.Left;
                            int workH = mi.rcWork.Bottom - mi.rcWork.Top;
                            ShowWindow(hwnd, SW_RESTORE);
                            SetWindowPos(hwnd, IntPtr.Zero, workX + (workW / 2), workY, workW / 2, workH, SWP_NOZORDER | SWP_SHOWWINDOW);
                        }
                    }
                    SendCombo(VK_LWIN, VK_RIGHT);
                    break;

                case "maximize":
                case "snap-up":
                    if (hwnd != IntPtr.Zero)
                    {
                        ShowWindow(hwnd, SW_MAXIMIZE);
                    }
                    SendCombo(VK_LWIN, VK_UP);
                    break;

                case "minimize":
                case "snap-down":
                    if (hwnd != IntPtr.Zero)
                    {
                        ShowWindow(hwnd, SW_MINIMIZE);
                    }
                    SendCombo(VK_LWIN, VK_DOWN);
                    break;

                // Feature #4: Multi-Monitor Window Management
                case "monitor-next":
                case "monitornext":
                    SendCombo(VK_LWIN, VK_SHIFT, VK_RIGHT);
                    break;
                case "monitor-prev":
                case "monitorprev":
                    SendCombo(VK_LWIN, VK_SHIFT, VK_LEFT);
                    break;

                // Feature #4: Virtual Desktops
                case "vdesk-left":
                case "vdeskleft":
                    SendCombo(VK_LWIN, VK_CONTROL, VK_LEFT);
                    break;
                case "vdesk-right":
                case "vdeskright":
                    SendCombo(VK_LWIN, VK_CONTROL, VK_RIGHT);
                    break;
                case "vdesk-new":
                case "vdesknew":
                    SendCombo(VK_LWIN, VK_CONTROL, VK_D);
                    break;
                case "vdesk-close":
                case "vdeskclose":
                    SendCombo(VK_LWIN, VK_CONTROL, VK_F4);
                    break;

                default:
                    Console.WriteLine("{\"status\":\"error\",\"message\":\"Unknown window action\"}");
                    return;
            }
            Console.WriteLine("{\"status\":\"ok\",\"action\":\"" + action + "\"}");
        }

        static void HandleKeyboard(string action, string param)
        {
            if (action == "backlight" || action == "light" || action == "f5")
            {
                // Dell Latitude 7400 keyboard backlight key is F5
                PressVk(VK_F5);
                Console.WriteLine("{\"status\":\"ok\",\"action\":\"backlight_f5_sent\"}");
            }
            else if (action == "f10")
            {
                // Alternate Dell backlight key is F10
                PressVk(VK_F10);
                Console.WriteLine("{\"status\":\"ok\",\"action\":\"backlight_f10_sent\"}");
            }
            else if (action == "mobility")
            {
                Process.Start("mblctr.exe");
                Console.WriteLine("{\"status\":\"ok\",\"action\":\"mobility_opened\"}");
            }
            else if (action == "press" || action == "key")
            {
                string key = (param ?? "").ToLower().Trim();
                bool numLockOn = (GetKeyState(0x90) & 1) != 0;

                switch (key)
                {
                    case "0":
                        if (numLockOn) PressVk(0x60); else SendChar('0');
                        break;
                    case "1":
                        if (numLockOn) PressVk(0x61); else SendChar('1');
                        break;
                    case "2":
                        if (numLockOn) PressVk(0x62); else SendChar('2');
                        break;
                    case "3":
                        if (numLockOn) PressVk(0x63); else SendChar('3');
                        break;
                    case "4":
                        if (numLockOn) PressVk(0x64); else SendChar('4');
                        break;
                    case "5":
                        if (numLockOn) PressVk(0x65); else SendChar('5');
                        break;
                    case "6":
                        if (numLockOn) PressVk(0x66); else SendChar('6');
                        break;
                    case "7":
                        if (numLockOn) PressVk(0x67); else SendChar('7');
                        break;
                    case "8":
                        if (numLockOn) PressVk(0x68); else SendChar('8');
                        break;
                    case "9":
                        if (numLockOn) PressVk(0x69); else SendChar('9');
                        break;
                    case ".":
                        if (numLockOn) PressVk(0x6E); else SendChar('.');
                        break;
                    case "+":
                        if (numLockOn) PressVk(0x6B); else SendChar('+');
                        break;
                    case "-":
                        if (numLockOn) PressVk(0x6D); else SendChar('-');
                        break;
                    case "*":
                        if (numLockOn) PressVk(0x6A); else SendChar('*');
                        break;
                    case "/":
                        if (numLockOn) PressVk(0x6F, true); else SendChar('/');
                        break;
                    case "backspace":
                    case "back":
                    case "bs":
                        PressVk(VK_BACK);
                        break;
                    case "tab":
                        PressVk(VK_TAB);
                        break;
                    case "enter":
                    case "return":
                        PressVk(VK_RETURN, true);
                        break;
                    case "esc":
                    case "escape":
                        PressVk(VK_ESCAPE);
                        break;
                    case "space":
                        PressVk(VK_SPACE);
                        break;
                    case "delete":
                    case "del":
                        PressVk(VK_DELETE, true);
                        break;
                    default:
                        if (param.Length == 1)
                        {
                            SendChar(param[0]);
                        }
                        else
                        {
                            SendText(param);
                        }
                        break;
                }
                Console.WriteLine("{\"status\":\"ok\",\"action\":\"key_pressed\",\"key\":" + JsonString(param) + "}");
            }
            else if (action == "type" || action == "text")
            {
                SendText(param);
                Console.WriteLine("{\"status\":\"ok\",\"action\":\"text_typed\",\"length\":" + (param != null ? param.Length : 0) + "}");
            }
            else
            {
                Console.WriteLine("{\"status\":\"error\",\"message\":\"Unknown keyboard action: " + action + "\"}");
            }
        }

        static void HandleSystem(string action, string param)
        {
            switch (action.ToLowerInvariant())
            {
                case "lock":
                    LockWorkStation();
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"locked\"}");
                    break;

                case "sleep":
                    SetSuspendState(false, true, false);
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"sleeping\"}");
                    break;

                case "shutdown":
                    int sec = string.IsNullOrEmpty(param) ? 0 : int.Parse(param);
                    Process.Start("shutdown.exe", "/s /t " + sec + " /c \"Shutdown requested from AltDeck Controller\"");
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"shutdown\",\"seconds\":" + sec + "}");
                    break;

                case "restart":
                    int rsec = string.IsNullOrEmpty(param) ? 0 : int.Parse(param);
                    Process.Start("shutdown.exe", "/r /t " + rsec + " /c \"Restart requested from AltDeck Controller\"");
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"restart\",\"seconds\":" + rsec + "}");
                    break;

                case "cancel-shutdown":
                case "abort":
                case "cancel":
                    Process.Start("shutdown.exe", "/a");
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"shutdown_cancelled\"}");
                    break;

                case "screen-off":
                case "monitor-off":
                    SendMessage((IntPtr)0xffff, WM_SYSCOMMAND, (IntPtr)SC_MONITORPOWER, (IntPtr)2);
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"screen_off\"}");
                    break;

                case "screen-on":
                case "monitor-on":
                    SendMessage((IntPtr)0xffff, WM_SYSCOMMAND, (IntPtr)SC_MONITORPOWER, (IntPtr)(-1));
                    mouse_event(MOUSEEVENTF_MOVE, 0, 1, 0, UIntPtr.Zero);
                    mouse_event(MOUSEEVENTF_MOVE, 0, -1, 0, UIntPtr.Zero);
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"screen_on\"}");
                    break;

                default:
                    Console.WriteLine("{\"status\":\"error\",\"message\":\"Unknown system action: " + action + "\"}");
                    break;
            }
        }

        class ProcItem : IComparable<ProcItem>
        {
            public int Pid;
            public string Name;
            public long RamMb;
            public int CompareTo(ProcItem other)
            {
                return other.RamMb.CompareTo(this.RamMb);
            }
        }

        static void HandleProcesses(string action, string param)
        {
            if (action == "kill")
            {
                int pid = int.Parse(param);
                var p = Process.GetProcessById(pid);
                string pName = p.ProcessName;
                p.Kill();
                Console.WriteLine("{\"status\":\"ok\",\"action\":\"killed\",\"pid\":" + pid + ",\"name\":" + JsonString(pName) + "}");
                return;
            }

            var list = new System.Collections.Generic.List<ProcItem>();
            foreach (var p in Process.GetProcesses())
            {
                try
                {
                    if (p.Id <= 4 || string.IsNullOrEmpty(p.ProcessName)) continue;
                    long mb = p.WorkingSet64 / (1024 * 1024);
                    if (mb < 20) continue;
                    list.Add(new ProcItem { Pid = p.Id, Name = p.ProcessName, RamMb = mb });
                }
                catch { }
            }

            list.Sort();
            int count = Math.Min(5, list.Count);
            var sb = new StringBuilder();
            sb.Append("{\"status\":\"ok\",\"processes\":[");
            for (int i = 0; i < count; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append("{\"pid\":").Append(list[i].Pid)
                  .Append(",\"name\":").Append(JsonString(list[i].Name))
                  .Append(",\"ramMb\":").Append(list[i].RamMb).Append("}");
            }
            sb.Append("]}");
            Console.WriteLine(sb.ToString());
        }

        static void HandleMouse(string action, string p1, string p2)
        {
            if (action == "move")
            {
                int dx = int.Parse(p1);
                int dy = int.Parse(p2);
                var pos = Cursor.Position;
                Cursor.Position = new System.Drawing.Point(pos.X + dx, pos.Y + dy);
                Console.WriteLine("{\"status\":\"ok\"}");
            }
            else if (action == "click")
            {
                if (p1 == "left")
                {
                    mouse_event(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                }
                else if (p1 == "right")
                {
                    mouse_event(MOUSEEVENTF_RIGHTDOWN | MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                }
                Console.WriteLine("{\"status\":\"ok\"}");
            }
            else if (action == "scroll")
            {
                int delta = int.Parse(p1);
                mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
                Console.WriteLine("{\"status\":\"ok\"}");
            }
        }

        static void HandlePower()
        {
            try
            {
                var power = System.Windows.Forms.SystemInformation.PowerStatus;
                int percent = (int)Math.Round(power.BatteryLifePercent * 100);
                if (percent < 0) percent = 0;
                if (percent > 100) percent = 100;

                bool isCharging = (power.BatteryChargeStatus & System.Windows.Forms.BatteryChargeStatus.Charging) != 0 ||
                                  power.PowerLineStatus == System.Windows.Forms.PowerLineStatus.Online;

                string lineStatus = power.PowerLineStatus.ToString();
                string chargeStatus = power.BatteryChargeStatus.ToString();

                Console.WriteLine("{\"status\":\"ok\",\"batteryPercent\":" + percent +
                                  ",\"isCharging\":" + (isCharging ? "true" : "false") +
                                  ",\"powerLine\":" + JsonString(lineStatus) +
                                  ",\"chargeStatus\":" + JsonString(chargeStatus) + "}");
            }
            catch (Exception ex)
            {
                Console.WriteLine("{\"status\":\"error\",\"message\":" + JsonString(ex.Message) + "}");
            }
        }

        static string JsonString(string text)
        {
            if (text == null) return "\"\"";
            return "\"" + text.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "\\n") + "\"";
        }
    }
}
