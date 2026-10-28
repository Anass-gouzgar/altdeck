using System;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Windows.Forms;

namespace TabDeckNative
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

        [DllImport("PowrProf.dll", CharSet = CharSet.Auto, ExactSpelling = true)]
        public static extern bool SetSuspendState(bool hiberate, bool forceCritical, bool disableWakeEvent);

        [DllImport("user32.dll")]
        static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        const uint INPUT_KEYBOARD = 1;
        const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
        const uint KEYEVENTF_KEYUP = 0x0002;

        // Virtual key codes
        const byte VK_VOLUME_MUTE = 0xAD;
        const byte VK_VOLUME_DOWN = 0xAE;
        const byte VK_VOLUME_UP = 0xAF;
        const byte VK_MEDIA_NEXT_TRACK = 0xB0;
        const byte VK_MEDIA_PREV_TRACK = 0xB1;
        const byte VK_MEDIA_STOP = 0xB2;
        const byte VK_MEDIA_PLAY_PAUSE = 0xB3;

        const byte VK_TAB = 0x09;
        const byte VK_MENU = 0x12; // Alt
        const byte VK_LWIN = 0x5B;
        const byte VK_SHIFT = 0x10;
        const byte VK_CONTROL = 0x11;
        const byte VK_D = 0x44;
        const byte VK_S = 0x53;
        const byte VK_F4 = 0x73;
        const byte VK_F5 = 0x74; // Dell Latitude 7400 Backlight key
        const byte VK_F10 = 0x79; // Alternate Dell backlight key

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

        static void SendKeyCombo(byte modifier, byte key)
        {
            byte scanMod = (byte)MapVirtualKey(modifier, 0);
            byte scanKey = (byte)MapVirtualKey(key, 0);

            keybd_event(modifier, scanMod, 0, UIntPtr.Zero);
            keybd_event(key, scanKey, 0, UIntPtr.Zero);
            System.Threading.Thread.Sleep(30);
            keybd_event(key, scanKey, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(modifier, scanMod, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }

        static void SendTripleCombo(byte mod1, byte mod2, byte key)
        {
            keybd_event(mod1, 0, 0, UIntPtr.Zero);
            keybd_event(mod2, 0, 0, UIntPtr.Zero);
            keybd_event(key, 0, 0, UIntPtr.Zero);
            System.Threading.Thread.Sleep(30);
            keybd_event(key, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(mod2, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(mod1, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
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
            string param = args.Length > 2 ? args[2] : "";

            try
            {
                switch (category)
                {
                    case "volume":
                        HandleVolume(action, param);
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
                        HandleKeyboard(action);
                        break;

                    case "system":
                        HandleSystem(action, param);
                        break;

                    case "mouse":
                        HandleMouse(action, param, args.Length > 3 ? args[3] : "");
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
            switch (action)
            {
                case "switch":
                    SendKeyCombo(VK_MENU, VK_TAB);
                    break;
                case "taskview":
                    SendKeyCombo(VK_LWIN, VK_TAB);
                    break;
                case "desktop":
                    SendKeyCombo(VK_LWIN, VK_D);
                    break;
                case "screenshot":
                    SendTripleCombo(VK_LWIN, VK_SHIFT, VK_S);
                    break;
                case "close":
                    SendKeyCombo(VK_MENU, VK_F4);
                    break;
                default:
                    Console.WriteLine("{\"status\":\"error\",\"message\":\"Unknown window action\"}");
                    return;
            }
            Console.WriteLine("{\"status\":\"ok\",\"action\":\"" + action + "\"}");
        }

        static void HandleKeyboard(string action)
        {
            if (action == "backlight" || action == "light" || action == "f5")
            {
                // Dell Latitude 7400 keyboard backlight key is F5
                TriggerMediaKeyRobust(VK_F5);
                Console.WriteLine("{\"status\":\"ok\",\"action\":\"backlight_f5_sent\"}");
            }
            else if (action == "f10")
            {
                // Alternate Dell backlight key is F10
                TriggerMediaKeyRobust(VK_F10);
                Console.WriteLine("{\"status\":\"ok\",\"action\":\"backlight_f10_sent\"}");
            }
            else if (action == "mobility")
            {
                Process.Start("mblctr.exe");
                Console.WriteLine("{\"status\":\"ok\",\"action\":\"mobility_opened\"}");
            }
        }

        static void HandleSystem(string action, string param)
        {
            switch (action)
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
                    int sec = string.IsNullOrEmpty(param) ? 30 : int.Parse(param);
                    Process.Start("shutdown.exe", "/s /t " + sec + " /c \"Shutdown requested from Tablet Controller\"");
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"shutdown\",\"seconds\":" + sec + "}");
                    break;

                case "restart":
                    int rsec = string.IsNullOrEmpty(param) ? 30 : int.Parse(param);
                    Process.Start("shutdown.exe", "/r /t " + rsec + " /c \"Restart requested from Tablet Controller\"");
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"restart\",\"seconds\":" + rsec + "}");
                    break;

                case "cancel-shutdown":
                    Process.Start("shutdown.exe", "/a");
                    Console.WriteLine("{\"status\":\"ok\",\"action\":\"shutdown_cancelled\"}");
                    break;

                default:
                    Console.WriteLine("{\"status\":\"error\",\"message\":\"Unknown system action\"}");
                    break;
            }
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

        static string JsonString(string text)
        {
            if (text == null) return "\"\"";
            return "\"" + text.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "\\n") + "\"";
        }
    }
}
