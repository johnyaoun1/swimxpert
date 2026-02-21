namespace SwimXpert.Api.Services;

public static class SwimSkillCatalog
{
    public static readonly IReadOnlyDictionary<int, string[]> Levels = new Dictionary<int, string[]>
    {
        [1] =
        [
            "Water adaptation (entering pool safely, sitting entry)",
            "Blowing bubbles (mouth to nose progression)",
            "Putting full face in water (3-5 sec)",
            "Assisted front float (5 sec)",
            "Assisted back float (5 sec)",
            "Assisted glide to instructor",
            "Kicking with support (holding wall or instructor)",
            "Basic pool safety rules",
            "Jump to instructor and recover",
            "Climb out independently"
        ],
        [2] =
        [
            "Independent front float (10 sec)",
            "Independent back float (10 sec)",
            "Front glide with streamline position",
            "Back glide in streamline",
            "Controlled kicking with kickboard (5-10 m)",
            "Back kicking with board",
            "Face in water with breath control (5 sec)",
            "Push off wall independently",
            "Recover to standing position",
            "Jump in and return to wall"
        ],
        [3] =
        [
            "Freestyle kick with correct body position",
            "Introduction to freestyle arms",
            "Backstroke kick with straight legs",
            "Backstroke arm introduction",
            "Streamline push-off from wall",
            "Side breathing introduction",
            "Front-to-back roll and recovery",
            "Swim 10m without stopping",
            "Retrieve object from shallow water",
            "Wall push-off and return"
        ],
        [4] =
        [
            "Rhythmic freestyle with side breathing",
            "Backstroke with full arm movement",
            "Introduction to breaststroke kick",
            "Breaststroke arm timing basics",
            "Treading water (20-30 sec)",
            "Streamline push-off with glide",
            "Swim 15-20m continuously",
            "Proper body alignment and head position",
            "Basic diving from kneeling",
            "Understanding lane discipline"
        ],
        [5] =
        [
            "Freestyle with consistent bilateral breathing",
            "Backstroke with proper rotation",
            "Breaststroke full coordination",
            "Introduction to butterfly kick (dolphin kick)",
            "Flip turn basics (freestyle)",
            "Open turns for backstroke and breaststroke",
            "Starts from pool edge",
            "Treading water (45 sec)",
            "Swim 50m continuously",
            "Underwater streamline dolphin kick"
        ],
        [6] =
        [
            "Advanced freestyle technique (catch and pull refinement)",
            "Backstroke efficiency and rotation control",
            "Breaststroke timing and glide efficiency",
            "Butterfly full stroke coordination",
            "Competitive starts (track start)",
            "Flip turns and fast wall transitions",
            "Streamline off every wall",
            "Treading water (60+ sec, hands out variation)",
            "Swim 100m continuously",
            "IM basics (individual medley transitions)",
            "Pace awareness and basic interval training"
        ]
    };
}
