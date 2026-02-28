import subprocess
import sys
import time

def main():
    services = [
        "mom/main.py",
        "semantic/main.py",
        "summary/main.py",
        "transcript/main.py"
    ]
    
    processes = []
    
    print("Starting AI Services...")
    for service in services:
        print(f"Starting {service}...")
        p = subprocess.Popen([sys.executable, service])
        processes.append((service, p))
        
    print("\nAll 4 services are running in this window!")
    print("Press Ctrl+C to stop them all cleanly.\n")
    
    try:
        # Keep the main thread alive to catch KeyboardInterrupt
        while True:
            time.sleep(1)
            # Check if any process has died unexpectedly
            for service, p in processes:
                if p.poll() is not None:
                    print(f"Warning: {service} stopped unexpectedly with return code {p.returncode}")
    except KeyboardInterrupt:
        print("\nCtrl+C detected! Stopping all services...")
        
    finally:
        for service, p in processes:
            if p.poll() is None:
                print(f"Terminating {service}...")
                p.terminate()
        
        # Wait for all to exit
        for service, p in processes:
            p.wait()
            
        print("All services stopped.")

if __name__ == "__main__":
    main()
