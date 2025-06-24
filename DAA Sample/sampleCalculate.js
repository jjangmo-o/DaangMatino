/*

RTS: Road Type Score
RFS: Road Frequency Score
RDS: Road Defect Score

SS: Severity Score
TRT: Total Response Time

*all data comes from DB

*/ 

//tentative variables for user input
let roadName, roadRating, roadDefect, roadType;

const maxRepairDaysPerMonth = 30;


function tentativeUserInput(roadName, roadRating, roadDefect, roadType){
    const roadData = {
        name: roadName,
        rating: roadRating,
        defect: roadDefect,
        type: roadType
    };
}

function calculateRTS(){
    return RTS;
}

function calculateRFS(){
    // 
}

function calculateRDS(){
    //
}

const RTS = calculateRTS();
const RFS = calculateRFS();
const RDS = calculateRDS();

function calculateSS(RTS, RFS, RDS){
    SS = (RTS*0.40) + (RFS*0.10) + (RDS*0.50);
    return SS;
}

const SS = calculateSS(RTS, RFS, RDS);

function calculateTRTS(){

    return TRT;
}

const TRT = calculateTRTS();
